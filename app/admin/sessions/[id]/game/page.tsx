'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useEcho } from '@/hooks/useEcho';
import type {
  Session,
  SessionRound,
  Question,
  SessionStatus,
  WsQuestionLaunched,
  WsQuestionClosed,
  WsPlayerEliminated,
  WsJackpotUpdated,
  WsRoundStarted,
  WsRoundEnded,
  WsTimerTick,
  WsGameEnded,
} from '@/lib/types';
import {
  ROUND_TYPE_LABELS,
  ROUND_STATUS_LABELS,
  QUESTION_STATUS_LABELS,
} from '@/lib/constants';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Play,
  Square,
  Eye,
  SkipForward,
  Trophy,
  Users,
  Zap,
  Timer,
  Loader2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  CheckCircle2,
  Clock,
  Radio,
  Flag,
  AlertTriangle,
  Crosshair,
  Swords,
  Crown,
} from 'lucide-react';
import clsx from 'clsx';

// ─── Types locaux ────────────────────────────────────────────

interface DashboardData {
  session_status: SessionStatus;
  jackpot: number;
  players_remaining: number;
  players_active: number;
  players_eliminated: number;
  current_round: SessionRound | null;
  current_question: Question | null;
}

type QuestionFlowStep = 'ready' | 'launched' | 'closed' | 'revealed';

// ─── Page ────────────────────────────────────────────────────

export default function AdminGameMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const echo = useEcho();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [rounds, setRounds] = useState<SessionRound[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  // Question en cours côté serveur
  const [activeQuestionId, setActiveQuestionId] = useState<number | null>(null);
  const [questionStep, setQuestionStep] = useState<QuestionFlowStep>('ready');
  const [secondChanceClosed, setSecondChanceClosed] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Décompte local synchronisé
  const startLocalTimer = useCallback((duration: number) => {
    setTimerSeconds(duration);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const stopLocalTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setTimerSeconds(0);
  }, []);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Confirmation dialog
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    action: () => Promise<void>;
    title: string;
    description: string;
  } | null>(null);

  // Expanded rounds
  const [expandedRound, setExpandedRound] = useState<number | null>(null);

  // Mise à jour du statut d'une question dans les rounds
  const updateQuestionStatus = useCallback(
    (questionId: number, status: string) => {
      setRounds((prev) =>
        prev.map((round) => ({
          ...round,
          questions: round.questions?.map((q) =>
            q.id === questionId ? { ...q, status } : q
          ),
        }))
      );
    },
    []
  );

  // Éliminés récents
  const [recentEliminated, setRecentEliminated] = useState<
    { pseudo: string; reason: string }[]
  >([]);

  // ─── Fetch initial ──────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    try {
      const [sessionRes, roundsRes, dashRes] = await Promise.all([
        api.get<{ data: Session }>(`/admin/sessions/${sessionId}`),
        api.get<{ data: SessionRound[] }>(
          `/admin/sessions/${sessionId}/rounds`
        ),
        api.get<DashboardData>(
          `/admin/sessions/${sessionId}/dashboard`
        ),
      ]);

      const s =
        sessionRes.data.data ?? (sessionRes.data as unknown as Session);
      setSession(s);

      const r =
        roundsRes.data.data ??
        (roundsRes.data as unknown as SessionRound[]);
      setRounds(r);

      const rawDash = dashRes.data as unknown as { data?: DashboardData };
      const d: DashboardData = (rawDash.data ?? dashRes.data) as DashboardData;
      setDashboard(d);

      // Déterminer la manche courante ouverte
      if (d.current_round) {
        setExpandedRound(d.current_round.id);
      }

      // Déterminer l'état de la question courante
      if (d.current_question) {
        setActiveQuestionId(d.current_question.id);
        if (d.current_question.status === 'launched') {
          setQuestionStep('launched');
          // Calculer le temps restant et démarrer le décompte local
          if (d.current_question.launched_at) {
            const elapsed = (Date.now() - new Date(d.current_question.launched_at).getTime()) / 1000;
            const remaining = Math.max(0, Math.floor(d.current_question.duration - elapsed));
            if (remaining > 0) startLocalTimer(remaining);
          } else {
            startLocalTimer(d.current_question.duration);
          }
        } else if (d.current_question.status === 'closed') {
          setQuestionStep('closed');
        } else if (d.current_question.status === 'revealed') {
          setQuestionStep('revealed');
        }
      }
    } catch {
      toast.error('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // ─── WebSocket écoute ───────────────────────────────────────

  useEffect(() => {
    if (!echo || !sessionId) return;

    const channelName = `session.${sessionId}`;
    const channel = echo.channel(channelName);

    channel
      .listen('.round.started', (e: WsRoundStarted) => {
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                current_round: {
                  id: 0,
                  session_id: Number(sessionId),
                  round_number: e.round_number,
                  round_type: e.round_type,
                  name: e.name,
                  description: e.rules_description,
                  display_order: e.round_number,
                  is_active: true,
                  status: 'in_progress',
                  started_at: new Date().toISOString(),
                  ended_at: null,
                },
              }
            : prev
        );
        // Recharger les rounds pour avoir les IDs corrects
        api
          .get<{ data: SessionRound[] }>(
            `/admin/sessions/${sessionId}/rounds`
          )
          .then((res) => {
            const r =
              res.data.data ??
              (res.data as unknown as SessionRound[]);
            setRounds(r);
            const active = r.find(
              (rnd) => rnd.round_number === e.round_number
            );
            if (active) setExpandedRound(active.id);
          });
        setActiveQuestionId(null);
        setQuestionStep('ready');
        toast.info(`Manche ${e.round_number} — ${e.name} démarrée`);
      })
      .listen('.question.launched', (e: WsQuestionLaunched) => {
        setActiveQuestionId(e.question.id);
        setQuestionStep('launched');
        startLocalTimer(e.question.duration);
        updateQuestionStatus(e.question.id, 'launched');
      })
      .listen('.question.closed', (e: WsQuestionClosed) => {
        setQuestionStep('closed');
        stopLocalTimer();
        setActiveQuestionId((prevId) => {
          if (prevId) updateQuestionStatus(prevId, 'closed');
          return prevId;
        });
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                players_remaining:
                  (prev.players_remaining || 0) - (Number(e.eliminated_count) || 0),
              }
            : prev
        );
      })
      .listen('.answer.revealed', () => {
        setQuestionStep('revealed');
        setActiveQuestionId((prevId) => {
          if (prevId) updateQuestionStatus(prevId, 'revealed');
          return prevId;
        });
      })
      .listen('.player.eliminated', (e: WsPlayerEliminated) => {
        setRecentEliminated(e.eliminated);
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                players_remaining: e.players_remaining,
                players_eliminated:
                  prev.players_eliminated + e.eliminated.length,
                jackpot: e.jackpot,
              }
            : prev
        );
      })
      .listen('.jackpot.updated', (e: WsJackpotUpdated) => {
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                jackpot: e.jackpot,
                players_remaining: e.players_remaining,
              }
            : prev
        );
      })
      .listen('.round.ended', (e: WsRoundEnded) => {
        setDashboard((prev) =>
          prev
            ? {
                ...prev,
                jackpot: e.jackpot,
                players_remaining: e.players_remaining,
              }
            : prev
        );
        setActiveQuestionId(null);
        setQuestionStep('ready');
        // Recharger les rounds
        api
          .get<{ data: SessionRound[] }>(
            `/admin/sessions/${sessionId}/rounds`
          )
          .then((res) => {
            setRounds(
              res.data.data ??
                (res.data as unknown as SessionRound[])
            );
          });
      })
      .listen('.timer.tick', (e: WsTimerTick) => {
        setTimerSeconds(e.remaining_seconds);
        // Re-sync le décompte local si l'écart est trop grand
        if (timerRef.current === null && e.remaining_seconds > 0) {
          startLocalTimer(e.remaining_seconds);
        }
      })
      .listen('.game.ended', (e: WsGameEnded) => {
        setDashboard((prev) =>
          prev
            ? { ...prev, session_status: 'ended' as SessionStatus, jackpot: e.final_jackpot }
            : prev
        );
        setSession((prev) => (prev ? { ...prev, status: 'ended' } : prev));
        toast.success('Partie terminée !');
      });

    return () => {
      echo.leaveChannel(channelName);
    };
  }, [echo, sessionId]);

  // ─── Actions de jeu ─────────────────────────────────────────

  const gameAction = useCallback(
    async (endpoint: string, body?: Record<string, unknown>): Promise<boolean> => {
      setActionLoading(endpoint);
      try {
        await api.post(
          `/admin/sessions/${sessionId}/game/${endpoint}`,
          body
        );
        return true;
      } catch (err: unknown) {
        const apiErr = (
          err as { response?: { data?: { message?: string } } }
        ).response?.data;
        toast.error(apiErr?.message ?? `Erreur: ${endpoint}`);
        return false;
      } finally {
        setActionLoading(null);
      }
    },
    [sessionId]
  );

  function confirmGameAction(
    title: string,
    description: string,
    action: () => Promise<void>
  ) {
    setPendingAction({ title, description, action });
    setConfirmOpen(true);
  }

  async function executeConfirmed() {
    if (!pendingAction) return;
    await pendingAction.action();
    setConfirmOpen(false);
    setPendingAction(null);
  }

  // Actions spécifiques
  function launchQuestion(questionId: number) {
    setSecondChanceClosed(false);
    gameAction('launch-question', { question_id: questionId });
  }

  function closeQuestion() {
    gameAction('close-question');
  }

  function revealAnswer() {
    gameAction('reveal-answer');
  }

  function nextRound() {
    confirmGameAction(
      'Manche suivante',
      'Passer à la manche suivante ?',
      () => gameAction('next-round')
    );
  }

  function endGame() {
    confirmGameAction(
      'Terminer la partie',
      'Êtes-vous sûr de vouloir terminer la session ? Cette action est irréversible.',
      () => gameAction('end')
    );
  }

  // Actions spéciales par type de manche
  function launchSecondChance() {
    gameAction('launch-second-chance');
  }

  async function closeSecondChance() {
    const ok = await gameAction('close-second-chance');
    if (ok) setSecondChanceClosed(true);
  }

  function finalizeTop4() {
    confirmGameAction(
      'Finaliser le Top 4',
      'Seuls les 4 meilleurs joueurs seront conservés. Continuer ?',
      () => gameAction('finalize-top4')
    );
  }

  function revealFinaleChoices() {
    gameAction('reveal-finale-choices');
  }

  function resolveFinale() {
    confirmGameAction(
      'Résoudre la finale',
      'Calculer les gains et terminer la finale ?',
      () => gameAction('resolve-finale')
    );
  }

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!session || !dashboard) return null;

  const isInProgress = session.status === 'in_progress';
  const isEnded = session.status === 'ended';
  const currentRoundData = dashboard.current_round;

  // Trouver la manche courante dans les rounds chargés
  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/sessions/${sessionId}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Pilotage du jeu</h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {session.name}
              </span>
              <StatusBadge status={session.status} />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {session.status === 'ready' && (
            <Button
              size="sm"
              onClick={async () => {
                setActionLoading('start');
                try {
                  const res = await api.post<{ data: Session }>(
                    `/admin/sessions/${sessionId}/game/start`
                  );
                  const s =
                    res.data.data ?? (res.data as unknown as Session);
                  setSession(s);
                  await fetchAll();
                  toast.success('Session démarrée');
                } catch (err: unknown) {
                  const apiErr = (
                    err as { response?: { data?: { message?: string } } }
                  ).response?.data;
                  toast.error(apiErr?.message ?? 'Impossible de démarrer');
                } finally {
                  setActionLoading(null);
                }
              }}
              disabled={!!actionLoading}
            >
              {actionLoading === 'start' ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1 h-4 w-4" />
              )}
              Démarrer la session
            </Button>
          )}
          {isInProgress && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={nextRound}
                disabled={!!actionLoading}
              >
                <SkipForward className="mr-1 h-4 w-4" />
                Manche suivante
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={endGame}
                disabled={!!actionLoading}
              >
                <Flag className="mr-1 h-4 w-4" />
                Terminer
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats temps réel */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Users className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">En jeu</p>
              <p className="text-2xl font-bold">
                {Number(dashboard.players_remaining) || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Éliminés</p>
              <p className="text-2xl font-bold">
                {Number(dashboard.players_eliminated) || 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10">
              <Trophy className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cagnotte</p>
              <p className="text-2xl font-bold">
                {(Number(dashboard.jackpot) || 0).toLocaleString('fr-FR')} pts
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Radio className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Manche</p>
              <p className="text-2xl font-bold">
                {currentRoundData
                  ? `${currentRoundData.round_number} / ${rounds.length}`
                  : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timer en cours */}
      {questionStep === 'launched' && timerSeconds > 0 && (
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Timer
                className={clsx(
                  'h-6 w-6',
                  timerSeconds <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-500'
                )}
              />
              <span className="text-lg font-semibold">
                Question en cours
              </span>
            </div>
            <div
              className={clsx(
                'text-3xl font-bold tabular-nums',
                timerSeconds <= 5 ? 'text-red-500' : 'text-blue-500'
              )}
            >
              {timerSeconds}s
            </div>
          </CardContent>
        </Card>
      )}

      {/* Éliminés récents */}
      {recentEliminated.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-400">
                Éliminés récents
              </p>
              <p className="text-sm text-red-300">
                {recentEliminated.map((p) => p.pseudo).join(', ')}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRecentEliminated([])}
              className="text-red-400"
            >
              Fermer
            </Button>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Liste des manches + questions */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Manches & Questions</h2>

        {rounds.map((round) => {
          const isExpanded = expandedRound === round.id;
          const isCurrent =
            currentRoundData?.round_number === round.round_number;
          const questions = round.questions ?? [];

          return (
            <Card
              key={round.id}
              className={clsx(
                'transition-colors',
                isCurrent && round.status === 'in_progress'
                  ? 'border-blue-500/40'
                  : ''
              )}
            >
              {/* Header manche */}
              <button
                onClick={() =>
                  setExpandedRound(isExpanded ? null : round.id)
                }
                className="flex w-full items-center gap-3 px-6 py-4 text-left"
              >
                <RoundIcon roundType={round.round_type} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      Manche {round.round_number}
                    </span>
                    {round.name && (
                      <span className="text-sm text-muted-foreground">
                        — {round.name}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {ROUND_TYPE_LABELS[round.round_type] ??
                        round.round_type}
                    </Badge>
                    <RoundStatusBadge status={round.status} />
                    <span>
                      {questions.length} question
                      {questions.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {isCurrent && round.status === 'in_progress' && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-500">
                    <CircleDot className="h-3 w-3" />
                    En cours
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                )}
              </button>

              {/* Corps : questions */}
              {isExpanded && (
                <CardContent className="border-t pt-4">
                  {questions.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      Aucune question dans cette manche.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {questions
                        .sort(
                          (a, b) => a.display_order - b.display_order
                        )
                        .map((q) => (
                          <QuestionRow
                            key={q.id}
                            question={q}
                            isActive={activeQuestionId === q.id}
                            questionStep={
                              activeQuestionId === q.id
                                ? questionStep
                                : q.status === 'revealed'
                                  ? 'revealed'
                                  : q.status === 'closed'
                                    ? 'closed'
                                    : 'ready'
                            }
                            canLaunch={
                              isInProgress &&
                              isCurrent &&
                              round.status === 'in_progress' &&
                              (questionStep === 'ready' ||
                                questionStep === 'revealed') &&
                              activeQuestionId !== q.id &&
                              q.status === 'pending'
                            }
                            canClose={
                              activeQuestionId === q.id &&
                              questionStep === 'launched'
                            }
                            canReveal={
                              activeQuestionId === q.id &&
                              questionStep === 'closed'
                            }
                            onLaunch={() => launchQuestion(q.id)}
                            onClose={closeQuestion}
                            onReveal={revealAnswer}
                            actionLoading={actionLoading}
                          />
                        ))}
                    </div>
                  )}

                  {/* Actions spéciales de manche */}
                  {isCurrent && round.status === 'in_progress' && (
                    <SpecialRoundActions
                      roundType={round.round_type}
                      questionStep={questionStep}
                      secondChanceClosed={secondChanceClosed}
                      actionLoading={actionLoading}
                      onLaunchSecondChance={launchSecondChance}
                      onCloseSecondChance={closeSecondChance}
                      onFinalizeTop4={finalizeTop4}
                      onRevealFinaleChoices={revealFinaleChoices}
                      onResolveFinale={resolveFinale}
                    />
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Partie terminée */}
      {isEnded && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="flex items-center gap-4 py-6">
            <Trophy className="h-10 w-10 text-yellow-500" />
            <div>
              <h3 className="text-lg font-bold">Partie terminée</h3>
              <p className="text-sm text-muted-foreground">
                Cagnotte finale :{' '}
                {(dashboard.jackpot ?? 0).toLocaleString('fr-FR')} pts — Joueurs
                restants : {dashboard.players_remaining ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction?.title}</DialogTitle>
            <DialogDescription>
              {pendingAction?.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setConfirmOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={executeConfirmed}
              disabled={!!actionLoading}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cercle flottant timer */}
      {questionStep === 'launched' && timerSeconds > 0 && (
        <div className="fixed bottom-6 left-6 z-50 flex h-16 w-16 items-center justify-center rounded-full shadow-lg border-2 transition-colors"
          style={{
            borderColor: timerSeconds <= 5 ? 'rgb(239 68 68)' : 'rgb(59 130 246)',
            backgroundColor: timerSeconds <= 5 ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
          }}
        >
          <span className={clsx(
            'text-xl font-bold tabular-nums',
            timerSeconds <= 5 ? 'text-red-500 animate-pulse' : 'text-blue-500'
          )}>
            {timerSeconds}
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sous-composants
// ═══════════════════════════════════════════════════════════════

function QuestionRow({
  question,
  isActive,
  questionStep,
  canLaunch,
  canClose,
  canReveal,
  onLaunch,
  onClose,
  onReveal,
  actionLoading,
}: {
  question: Question;
  isActive: boolean;
  questionStep: QuestionFlowStep;
  canLaunch: boolean;
  canClose: boolean;
  canReveal: boolean;
  onLaunch: () => void;
  onClose: () => void;
  onReveal: () => void;
  actionLoading: string | null;
}) {
  const isDone =
    question.status === 'revealed' ||
    (question.status === 'closed' && !isActive);

  return (
    <div
      className={clsx(
        'flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors',
        isActive && questionStep === 'launched'
          ? 'border-blue-500/40 bg-blue-500/5'
          : isActive && questionStep === 'closed'
            ? 'border-orange-500/40 bg-orange-500/5'
            : isDone
              ? 'border-muted bg-muted/30'
              : 'border-border'
      )}
    >
      {/* Status icon */}
      <QuestionStatusIcon status={question.status} isActive={isActive} />

      {/* Question info */}
      <div className="min-w-0 flex-1">
        <p
          className={clsx(
            'truncate text-sm font-medium',
            isDone ? 'text-muted-foreground' : ''
          )}
        >
          Q{question.display_order}. {question.text}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {question.duration}s
          </span>
          <span>
            {question.answer_type === 'qcm'
              ? `QCM (${question.choices?.length ?? 0} choix)`
              : question.answer_type === 'number'
                ? 'Nombre'
                : 'Texte'}
          </span>
          {question.correct_answer && (
            <span className="font-medium text-green-600">
              ✓ {question.correct_answer}
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex shrink-0 items-center gap-1.5">
        {canLaunch && (
          <Button
            size="sm"
            onClick={onLaunch}
            disabled={!!actionLoading}
            className="gap-1 bg-green-600 hover:bg-green-700"
          >
            {actionLoading === 'launch-question' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5" />
            )}
            Lancer
          </Button>
        )}
        {canClose && (
          <Button
            size="sm"
            onClick={onClose}
            disabled={!!actionLoading}
            variant="outline"
            className="gap-1 border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
          >
            {actionLoading === 'close-question' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Square className="h-3.5 w-3.5" />
            )}
            Clôturer
          </Button>
        )}
        {canReveal && (
          <Button
            size="sm"
            onClick={onReveal}
            disabled={!!actionLoading}
            variant="outline"
            className="gap-1 border-purple-500/50 text-purple-500 hover:bg-purple-500/10"
          >
            {actionLoading === 'reveal-answer' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Révéler
          </Button>
        )}

        {/* Badge statut si pas d'action */}
        {!canLaunch && !canClose && !canReveal && (
          <Badge
            variant={
              question.status === 'revealed'
                ? 'default'
                : question.status === 'closed'
                  ? 'outline'
                  : 'secondary'
            }
            className="text-xs"
          >
            {QUESTION_STATUS_LABELS[question.status] ?? question.status}
          </Badge>
        )}
      </div>
    </div>
  );
}

function QuestionStatusIcon({
  status,
  isActive,
}: {
  status: string;
  isActive: boolean;
}) {
  if (isActive) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-500/20">
        <Radio className="h-4 w-4 text-blue-500" />
      </div>
    );
  }
  if (status === 'revealed') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/20">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      </div>
    );
  }
  if (status === 'closed') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/20">
        <Square className="h-4 w-4 text-orange-500" />
      </div>
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
      <CircleDot className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function RoundIcon({ roundType }: { roundType: string }) {
  const icons: Record<string, React.ReactNode> = {
    sudden_death: <Zap className="h-5 w-5 text-red-500" />,
    hint: <Eye className="h-5 w-5 text-blue-500" />,
    second_chance: <Loader2 className="h-5 w-5 text-purple-500" />,
    round_skip: <SkipForward className="h-5 w-5 text-orange-500" />,
    top4_elimination: <Crosshair className="h-5 w-5 text-pink-500" />,
    duel_jackpot: <Swords className="h-5 w-5 text-amber-500" />,
    duel_elimination: <Swords className="h-5 w-5 text-red-500" />,
    finale: <Crown className="h-5 w-5 text-yellow-500" />,
  };

  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
      {icons[roundType] ?? <CircleDot className="h-5 w-5" />}
    </div>
  );
}

function RoundStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: 'bg-gray-500/10 text-gray-500',
    in_progress: 'bg-blue-500/10 text-blue-500',
    completed: 'bg-green-500/10 text-green-500',
    skipped: 'bg-gray-500/10 text-gray-400',
  };

  return (
    <span
      className={clsx(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        colors[status] ?? colors.pending
      )}
    >
      {ROUND_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function SpecialRoundActions({
  roundType,
  questionStep,
  secondChanceClosed,
  actionLoading,
  onLaunchSecondChance,
  onCloseSecondChance,
  onFinalizeTop4,
  onRevealFinaleChoices,
  onResolveFinale,
}: {
  roundType: string;
  questionStep: QuestionFlowStep;
  secondChanceClosed: boolean;
  actionLoading: string | null;
  onLaunchSecondChance: () => void;
  onCloseSecondChance: () => void;
  onFinalizeTop4: () => void;
  onRevealFinaleChoices: () => void;
  onResolveFinale: () => void;
}) {
  // Afficher les actions spéciales uniquement après que la question principale est fermée/révélée
  if (
    roundType !== 'second_chance' &&
    roundType !== 'top4_elimination' &&
    roundType !== 'finale'
  ) {
    return null;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <p className="mb-3 text-sm font-medium text-muted-foreground">
        Actions spéciales
      </p>
      <div className="flex flex-wrap gap-2">
        {/* Seconde chance (manche 3) */}
        {roundType === 'second_chance' && questionStep === 'revealed' && !secondChanceClosed && (
          <>
            <Button
              size="sm"
              onClick={onLaunchSecondChance}
              disabled={!!actionLoading}
              className="gap-1"
            >
              {actionLoading === 'launch-second-chance' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Lancer seconde chance
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onCloseSecondChance}
              disabled={!!actionLoading}
              className="gap-1"
            >
              {actionLoading === 'close-second-chance' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Clôturer seconde chance
            </Button>
          </>
        )}

        {/* Top 4 (manche 5) */}
        {roundType === 'top4_elimination' && (
          <Button
            size="sm"
            onClick={onFinalizeTop4}
            disabled={!!actionLoading}
            className="gap-1 bg-pink-600 hover:bg-pink-700"
          >
            {actionLoading === 'finalize-top4' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="h-3.5 w-3.5" />
            )}
            Finaliser Top 4
          </Button>
        )}

        {/* Finale (manche 8) */}
        {roundType === 'finale' && (
          <>
            <Button
              size="sm"
              onClick={onRevealFinaleChoices}
              disabled={!!actionLoading}
              className="gap-1"
            >
              {actionLoading === 'reveal-finale-choices' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
              Révéler les choix
            </Button>
            <Button
              size="sm"
              onClick={onResolveFinale}
              disabled={!!actionLoading}
              className="gap-1 bg-yellow-600 hover:bg-yellow-700"
            >
              {actionLoading === 'resolve-finale' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Crown className="h-3.5 w-3.5" />
              )}
              Résoudre la finale
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
