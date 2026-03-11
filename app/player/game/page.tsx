'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useGameStore } from '@/stores/gameStore';
import { useSessionChannel } from '@/hooks/useSessionChannel';
import { usePlayerChannel } from '@/hooks/usePlayerChannel';
import { useTimer } from '@/hooks/useTimer';
import { Timer } from '@/components/shared/Timer';
import { JackpotCounter } from '@/components/shared/JackpotCounter';
import { QuestionDisplay } from '@/components/shared/QuestionDisplay';
import { ROUND_TYPE_LABELS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Trophy,
  Zap,
  Shield,
  SkipForward,
  Eye,
  LogOut,
  AlertTriangle,
  Swords,
} from 'lucide-react';
import clsx from 'clsx';
import { toast } from 'sonner';

// ─── Types locaux ─────────────────────────────────────────────

interface PlayerStatus {
  player: {
    pseudo: string;
    full_name: string;
  };
  my_status: {
    status: string;
    capital: number;
    hint_used: boolean;
  };
  session: {
    id: number;
    name: string;
    status: string;
    jackpot: number;
    players_remaining: number;
  };
  current_round: {
    round_number: number;
    name: string;
    round_type: string;
    rules_description: string;
  } | null;
  current_question: {
    id: number;
    text: string;
    answer_type: string;
    media_url: string | null;
    media_type: string;
    duration: number;
    launched_at: string;
    choices?: { id: number; label: string; display_order: number }[];
  } | null;
  already_answered: boolean;
  session_player_id: number;
}

// ─── Page ─────────────────────────────────────────────────────

export default function PlayerGamePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionName, setSessionName] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const startTimeRef = useRef<number>(Date.now());

  const {
    phase,
    currentRound,
    currentQuestion,
    selectedChoiceId,
    answerValue,
    hasAnswered,
    isCorrect,
    correctAnswer,
    revealedChoices,
    hintUsed,
    removedChoiceIds,
    hintText,
    playerStatus,
    capital,
    jackpot,
    playersRemaining,
    timerSeconds,
    eliminatedPlayers,
    winners,
    finalJackpot,
    setQuestion,
    setSelectedChoice,
    setAnswerValue,
    markAnswered,
    setPlayerStatus,
    setSessionPlayerId,
    updateJackpot,
    setPhase,
    setRound,
    applyHint,
    resetGame,
  } = useGameStore();

  const secondChanceQuestion = useGameStore((s) => s.secondChanceQuestion);
  const mainQuestionId = useGameStore((s) => s.mainQuestionId);
  const scIsCorrect = useGameStore((s) => s.scIsCorrect);
  const scCorrectAnswer = useGameStore((s) => s.scCorrectAnswer);
  const scRevealedChoices = useGameStore((s) => s.scRevealedChoices);
  const markScAnswered = useGameStore((s) => s.markScAnswered);
  const duelAssignments = useGameStore((s) => s.duelAssignments);
  const duelCurrentTurn = useGameStore((s) => s.duelCurrentTurn);
  const finaleChoices = useGameStore((s) => s.finaleChoices);
  const finaleScenario = useGameStore((s) => s.finaleScenario);

  const { startCountdown } = useTimer();
  const sessionPlayerId = useGameStore((s) => s.sessionPlayerId);

  // WebSocket hooks
  useSessionChannel(sessionId);
  usePlayerChannel(sessionPlayerId);

  // ─── Chargement initial ─────────────────────────────────────

  useEffect(() => {
    const token = localStorage.getItem('player_token');
    if (!token) {
      router.replace('/player/join');
      return;
    }

    async function fetchStatus() {
      try {
        const res = await api.get<PlayerStatus>('/player/status');
        const data = res.data;
        setSessionId(data.session.id);
        setSessionName(data.session.name);
        if (data.player?.pseudo) setPseudo(data.player.pseudo);
        setSessionPlayerId(data.session_player_id);
        updateJackpot(data.session.jackpot, data.session.players_remaining);
        setPlayerStatus(data.my_status.status as 'waiting' | 'active' | 'eliminated' | 'finalist');

        if (data.my_status.hint_used) {
          useGameStore.setState({ hintUsed: true, hintAvailable: false });
        }
        useGameStore.setState({ capital: data.my_status.capital });

        if (data.current_round) {
          setRound({
            round_number: data.current_round.round_number,
            name: data.current_round.name,
            round_type: data.current_round.round_type as 'sudden_death',
            rules_description: data.current_round.rules_description,
          });
        }

        if (data.current_question && !data.already_answered) {
          setQuestion({
            id: data.current_question.id,
            text: data.current_question.text,
            answer_type: data.current_question.answer_type as 'qcm',
            media_url: data.current_question.media_url,
            media_type: (data.current_question.media_type || 'none') as 'none',
            duration: data.current_question.duration,
            launched_at: data.current_question.launched_at,
            choices: data.current_question.choices,
          });
          // Calculer le temps restant
          const elapsed = (Date.now() - new Date(data.current_question.launched_at).getTime()) / 1000;
          const remaining = Math.max(0, Math.floor(data.current_question.duration - elapsed));
          startCountdown(remaining);
        } else if (data.already_answered) {
          if (data.current_question) {
            setQuestion({
              id: data.current_question.id,
              text: data.current_question.text,
              answer_type: data.current_question.answer_type as 'qcm',
              media_url: data.current_question.media_url,
              media_type: (data.current_question.media_type || 'none') as 'none',
              duration: data.current_question.duration,
              launched_at: data.current_question.launched_at,
              choices: data.current_question.choices,
            });
          }
          markAnswered();
        }

        if (data.my_status.status === 'eliminated') {
          setPhase('eliminated');
        } else if (data.session.status === 'ended') {
          setPhase('game_ended');
        }
      } catch {
        router.replace('/player/join');
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mémoriser le timestamp question pour calcul du temps de réponse
  useEffect(() => {
    if ((phase === 'question' && currentQuestion) || (phase === 'second_chance' && secondChanceQuestion)) {
      startTimeRef.current = Date.now();
    }
  }, [phase, currentQuestion?.id, secondChanceQuestion?.id]);

  // ─── Actions joueur ─────────────────────────────────────────

  async function submitAnswer(choiceId?: number) {
    if (!currentQuestion || submitting) return;
    setSubmitting(true);
    const responseTimeMs = Date.now() - startTimeRef.current;

    try {
      const body: Record<string, unknown> = {
        question_id: currentQuestion.id,
        response_time_ms: responseTimeMs,
      };

      const effectiveChoiceId = choiceId ?? selectedChoiceId;
      if (currentQuestion.answer_type === 'qcm' && effectiveChoiceId) {
        body.selected_choice_id = effectiveChoiceId;
      } else {
        body.answer_value = answerValue;
      }

      await api.post('/player/answer', body);
      markAnswered();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur lors de l\'envoi de la réponse';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function requestHint() {
    try {
      const res = await api.post<{ hint: { hint_type: string; removed_choice_ids?: number[]; revealed_letters?: string[]; masked_answer?: string; range_hint_text?: string; range_min?: number; range_max?: number; time_penalty_seconds: number } }>('/player/hint');
      applyHint(res.data.hint);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Indice non disponible';
      toast.error(msg);
    }
  }

  async function submitSecondChanceAnswer(choiceId?: number) {
    if (!secondChanceQuestion || !mainQuestionId || submitting) return;
    setSubmitting(true);
    const responseTimeMs = Date.now() - startTimeRef.current;

    try {
      const body: Record<string, unknown> = {
        question_id: mainQuestionId,
        is_second_chance: true,
        second_chance_question_id: secondChanceQuestion.id,
        response_time_ms: responseTimeMs,
      };

      const effectiveChoiceId = choiceId ?? selectedChoiceId;
      if (secondChanceQuestion.answer_type === 'qcm' && effectiveChoiceId) {
        body.selected_sc_choice_id = effectiveChoiceId;
      } else {
        body.answer_value = answerValue;
      }

      await api.post('/player/answer', body);
      markScAnswered();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur lors de l\'envoi de la réponse';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function passManche() {
    try {
      await api.post('/player/pass-manche');
      setPhase('round_skipped');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Impossible de passer la manche';
      toast.error(msg);
    }
  }

  async function submitFinaleChoice(choice: 'continue' | 'abandon') {
    try {
      await api.post('/player/finale-choice', { choice });
      markAnswered();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erreur';
      toast.error(msg);
    }
  }

  function handleLogout() {
    localStorage.removeItem('player_token');
    resetGame();
    router.replace('/player/join');
  }

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header bar */}
      <header className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-400">{sessionName}</span>
          {pseudo && (
            <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-white">
              {pseudo}
            </span>
          )}
          {currentRound && (
            <span className="rounded-full bg-blue-600/20 px-2.5 py-0.5 text-xs font-medium text-blue-400">
              Manche {currentRound.round_number}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm">
            <Zap className="h-4 w-4 text-yellow-400" />
            <span className="font-semibold tabular-nums">{capital}</span>
          </div>
          <JackpotCounter amount={jackpot} size="sm" />
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span>{playersRemaining} en jeu</span>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
        {/* ── WAITING ── */}
        {phase === 'waiting' && (
          <WaitingView sessionName={sessionName} />
        )}

        {/* ── ROUND INTRO ── */}
        {phase === 'round_intro' && currentRound && (
          <RoundIntroView round={currentRound} />
        )}

        {/* ── DUEL WAITING (en attente de son tour) ── */}
        {phase === 'duel_waiting' && (
          <DuelWaitingView
            assignments={duelAssignments}
            currentTurn={duelCurrentTurn}
            sessionPlayerId={sessionPlayerId}
          />
        )}

        {/* ── DUEL DONE (déjà passé) ── */}
        {phase === 'duel_done' && (
          <DuelDoneView
            assignments={duelAssignments}
            currentTurn={duelCurrentTurn}
          />
        )}

        {/* ── QUESTION ── */}
        {phase === 'question' && currentQuestion && (
          <QuestionView
            question={currentQuestion}
            selectedChoiceId={selectedChoiceId}
            answerValue={answerValue}
            removedChoiceIds={removedChoiceIds}
            hintText={hintText}
            onSelectChoice={setSelectedChoice}
            onChangeAnswer={setAnswerValue}
            onSubmit={submitAnswer}
            submitting={submitting}
            timerSeconds={timerSeconds}
            totalDuration={currentQuestion.duration}
            // Indice manche 2
            showHint={currentRound?.round_type === 'hint' && !hintUsed}
            onRequestHint={requestHint}
            // Passer manche 4
            showPassManche={currentRound?.round_type === 'round_skip'}
            onPassManche={passManche}
          />
        )}

        {/* ── ANSWERED (attente résultat) ── */}
        {phase === 'answered' && (
          <div className="flex flex-col items-center gap-4 text-center">
            {timerSeconds > 0 && currentQuestion && (
              <Timer seconds={timerSeconds} total={currentQuestion.duration} size="lg" />
            )}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/20">
              <CheckCircle2 className="h-10 w-10 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold">Réponse envoyée !</h2>
            <p className="text-gray-400">En attente du résultat…</p>
          </div>
        )}

        {/* ── ANSWER REVEALED (bonne réponse affichée, en attente résultats) ── */}
        {phase === 'answer_revealed' && (
          <AnswerRevealedPlayerView
            correctAnswer={correctAnswer}
            revealedChoices={revealedChoices}
          />
        )}

        {/* ── SECOND CHANCE DANGER (mauvaise réponse, en attente SC) ── */}
        {phase === 'second_chance_danger' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-600/20 animate-pulse">
              <AlertTriangle className="h-10 w-10 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-red-400">Vous êtes en danger !</h2>
            <p className="text-gray-400">
              Préparez-vous pour la question de seconde chance…
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-3 w-3 animate-bounce rounded-full bg-red-500 [animation-delay:0ms]" />
              <div className="h-3 w-3 animate-bounce rounded-full bg-red-500 [animation-delay:150ms]" />
              <div className="h-3 w-3 animate-bounce rounded-full bg-red-500 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* ── SECOND CHANCE SAFE (bonne réponse, en attente question suivante) ── */}
        {phase === 'second_chance_safe' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600/20">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-green-400">Bonne réponse !</h2>
            <p className="text-gray-400">
              Les autres joueurs tentent leur seconde chance…
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-3 w-3 animate-bounce rounded-full bg-green-500 [animation-delay:0ms]" />
              <div className="h-3 w-3 animate-bounce rounded-full bg-green-500 [animation-delay:150ms]" />
              <div className="h-3 w-3 animate-bounce rounded-full bg-green-500 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* ── SECOND CHANCE WAITING (bonne réponse → attente) ── */}
        {phase === 'second_chance_waiting' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600/20">
              <CheckCircle2 className="h-10 w-10 text-green-400" />
            </div>
            <h2 className="text-xl font-bold">Bonne réponse !</h2>
            <p className="text-gray-400">
              Les autres joueurs tentent leur seconde chance…
            </p>
            <div className="mt-4 flex items-center gap-2">
              <div className="h-3 w-3 animate-bounce rounded-full bg-purple-500 [animation-delay:0ms]" />
              <div className="h-3 w-3 animate-bounce rounded-full bg-purple-500 [animation-delay:150ms]" />
              <div className="h-3 w-3 animate-bounce rounded-full bg-purple-500 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* ── SECOND CHANCE (mauvaise réponse → question SC) ── */}
        {phase === 'second_chance' && secondChanceQuestion && (
          <div className="flex w-full max-w-xl flex-col items-center gap-4">
            <div className="rounded-xl border-2 border-purple-600/40 bg-purple-600/10 px-4 py-2 text-center text-sm font-semibold text-purple-300">
              <Shield className="mr-1.5 inline-block h-4 w-4" />
              Seconde chance !
            </div>
            <QuestionView
              question={secondChanceQuestion}
              selectedChoiceId={selectedChoiceId}
              answerValue={answerValue}
              removedChoiceIds={[]}
              hintText={null}
              onSelectChoice={setSelectedChoice}
              onChangeAnswer={setAnswerValue}
              onSubmit={submitSecondChanceAnswer}
              submitting={submitting}
              timerSeconds={timerSeconds}
              totalDuration={secondChanceQuestion.duration}
            />
          </div>
        )}

        {/* ── SC ANSWERED (attente résultat SC) ── */}
        {phase === 'sc_answered' && (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-purple-600/20">
              <Shield className="h-10 w-10 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold">Réponse envoyée !</h2>
            <p className="text-gray-400">En attente du résultat de la seconde chance…</p>
          </div>
        )}

        {/* ── SC ANSWER REVEALED (réponse SC affichée, en attente résultats) ── */}
        {phase === 'sc_answer_revealed' && (
          <AnswerRevealedPlayerView
            correctAnswer={scCorrectAnswer}
            revealedChoices={scRevealedChoices}
            labelPrefix="Seconde chance"
          />
        )}

        {/* ── SC RESULT (résultat seconde chance) ── */}
        {phase === 'sc_result' && (
          <ResultView
            isCorrect={scIsCorrect}
            correctAnswer={scCorrectAnswer}
            revealedChoices={scRevealedChoices}
            labelPrefix="Seconde chance"
          />
        )}

        {/* ── RESULT ── */}
        {phase === 'result' && (
          <ResultView
            isCorrect={isCorrect}
            correctAnswer={correctAnswer}
            revealedChoices={revealedChoices}
          />
        )}

        {/* ── ELIMINATED ── */}
        {phase === 'round_skipped' && (
          <RoundSkippedView />
        )}

        {phase === 'eliminated' && (
          <EliminatedView onLogout={handleLogout} />
        )}

        {/* ── FINALE CHOICE ── */}
        {phase === 'finale_choice' && (
          <FinaleChoiceView onChoice={submitFinaleChoice} />
        )}

        {/* ── FINALE RESULT ── */}
        {phase === 'finale_result' && (
          <FinaleResultView choices={finaleChoices} scenario={finaleScenario} />
        )}

        {/* ── GAME ENDED ── */}
        {phase === 'game_ended' && (
          <GameEndedView
            winners={winners}
            finalJackpot={finalJackpot}
            onLogout={handleLogout}
          />
        )}
      </main>

      {/* Éliminés récents */}
      {eliminatedPlayers.length > 0 && phase !== 'eliminated' && (
        <div className="border-t border-gray-800 px-4 py-2">
          <p className="text-xs text-red-400">
            Éliminé(s) : {eliminatedPlayers.map((p) => p.pseudo).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sous-composants
// ═══════════════════════════════════════════════════════════════

function WaitingView({ sessionName }: { sessionName: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/20">
        <Zap className="h-10 w-10 text-blue-400" />
      </div>
      <h1 className="text-2xl font-bold">Salle de jeu</h1>
      <p className="max-w-sm text-gray-400">
        Vous êtes connecté à <span className="font-medium text-white">{sessionName}</span>.
        La partie va bientôt commencer…
      </p>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
        <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:150ms]" />
        <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function RoundIntroView({
  round,
}: {
  round: { round_number: number; name: string; round_type: string; rules_description: string };
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-purple-600 text-4xl font-black text-white shadow-lg">
        {round.round_number}
      </div>
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-blue-400">
          {ROUND_TYPE_LABELS[round.round_type] ?? round.round_type}
        </p>
        <h1 className="mt-1 text-3xl font-bold">{round.name || `Manche ${round.round_number}`}</h1>
      </div>
      {round.rules_description && (
        <p className="max-w-md text-gray-400">{round.rules_description}</p>
      )}
      <p className="mt-2 text-sm text-gray-500">La question arrive…</p>
    </div>
  );
}

function QuestionView({
  question,
  selectedChoiceId,
  answerValue,
  removedChoiceIds,
  hintText,
  onSelectChoice,
  onChangeAnswer,
  onSubmit,
  submitting,
  timerSeconds,
  totalDuration,
  showHint,
  onRequestHint,
  showPassManche,
  onPassManche,
}: {
  question: {
    id: number;
    text: string;
    answer_type: string;
    media_url: string | null;
    media_type: string;
    duration: number;
    choices?: { id: number; label: string; display_order: number }[];
  };
  selectedChoiceId: number | null;
  answerValue: string;
  removedChoiceIds: number[];
  hintText: string | null;
  onSelectChoice: (id: number) => void;
  onChangeAnswer: (val: string) => void;
  onSubmit: (choiceId?: number) => void;
  submitting: boolean;
  timerSeconds: number;
  totalDuration: number;
  showHint?: boolean;
  onRequestHint?: () => void;
  showPassManche?: boolean;
  onPassManche?: () => void;
}) {
  const hasAnswer =
    question.answer_type === 'qcm' ? selectedChoiceId !== null : answerValue.trim() !== '';

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-6">
      {/* Timer */}
      <Timer seconds={timerSeconds} total={totalDuration} size="lg" />

      {/* Question */}
      <QuestionDisplay
        text={question.text}
        mediaUrl={question.media_url}
        mediaType={question.media_type as 'none'}
      />

      {/* Choix QCM — sélection = soumission automatique */}
      {question.answer_type === 'qcm' && question.choices && (
        <div className="grid w-full gap-3 sm:grid-cols-2">
          {question.choices
            .filter((c) => !removedChoiceIds.includes(c.id))
            .sort((a, b) => a.display_order - b.display_order)
            .map((choice) => (
              <button
                key={choice.id}
                disabled={submitting || selectedChoiceId !== null}
                onClick={() => {
                  onSelectChoice(choice.id);
                  onSubmit(choice.id);
                }}
                className={clsx(
                  'rounded-xl border-2 px-4 py-3 text-left text-sm font-medium transition-all',
                  selectedChoiceId === choice.id
                    ? 'border-blue-500 bg-blue-600/20 text-white'
                    : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                )}
              >
                {choice.label}
              </button>
            ))}
        </div>
      )}

      {/* Réponse texte / numérique */}
      {question.answer_type !== 'qcm' && (
        <>
          <input
            type={question.answer_type === 'number' ? 'number' : 'text'}
            value={answerValue}
            onChange={(e) => onChangeAnswer(e.target.value)}
            placeholder={
              question.answer_type === 'number'
                ? 'Entrez un nombre\u2026'
                : 'Votre r\u00e9ponse\u2026'
            }
            className="w-full rounded-xl border-2 border-gray-700 bg-gray-800/50 px-4 py-3 text-center text-lg font-medium text-white outline-none transition-colors focus:border-blue-500"
            autoFocus
          />
          {hintText && (
            <div className="w-full rounded-xl border-2 border-yellow-600/40 bg-yellow-600/10 px-4 py-3 text-center font-medium text-yellow-300">
              <Eye className="mr-1.5 inline-block h-4 w-4" />
              <span className={hintText.includes('_') ? 'font-mono text-lg tracking-widest' : 'text-sm'}>
                {hintText}
              </span>
            </div>
          )}
        </>
      )}

      {/* Bouton Valider (texte/nombre uniquement) */}
      {question.answer_type !== 'qcm' && (
        <div className="flex w-full flex-col gap-2">
          <Button
            onClick={onSubmit}
            disabled={!hasAnswer || submitting}
            className="w-full py-6 text-lg"
          >
            {submitting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <CheckCircle2 className="mr-2 h-5 w-5" />
            )}
            Valider ma réponse
          </Button>
        </div>
      )}

      {/* Actions secondaires (indice, passer la manche) */}
      <div className="flex w-full gap-2">
        {showHint && (
          <Button
            variant="outline"
            onClick={onRequestHint}
            className="flex-1 border-yellow-600/50 text-yellow-400 hover:bg-yellow-600/10"
          >
            <Eye className="mr-2 h-4 w-4" />
            Utiliser l&apos;indice
          </Button>
        )}
        {showPassManche && (
          <Button
            variant="outline"
            onClick={onPassManche}
            className="flex-1 border-orange-600/50 text-orange-400 hover:bg-orange-600/10"
          >
            <SkipForward className="mr-2 h-4 w-4" />
            Passer la manche
          </Button>
        )}
      </div>
    </div>
  );
}

function AnswerRevealedPlayerView({
  correctAnswer,
  revealedChoices,
  labelPrefix,
}: {
  correctAnswer: string | null;
  revealedChoices: ({ id: number; label: string; is_correct: boolean })[] | null;
  labelPrefix?: string;
}) {
  const prefix = labelPrefix ? `${labelPrefix} — ` : '';
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600/20">
        <Eye className="h-14 w-14 text-blue-400" />
      </div>
      <h2 className="text-2xl font-bold">{prefix}La bonne réponse</h2>

      {correctAnswer && (
        <p className="text-gray-400">
          La bonne réponse est :{' '}
          <span className="font-semibold text-green-400">{correctAnswer}</span>
        </p>
      )}

      {revealedChoices && revealedChoices.length > 0 && (
        <div className="grid w-full max-w-md gap-2">
          {revealedChoices.map((c) => (
            <div
              key={c.id}
              className={clsx(
                'rounded-lg border px-4 py-2 text-sm',
                c.is_correct
                  ? 'border-green-600 bg-green-600/10 text-green-400'
                  : 'border-gray-700 text-gray-500'
              )}
            >
              {c.label}
              {c.is_correct && <CheckCircle2 className="ml-2 inline h-4 w-4" />}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500">En attente des résultats…</p>
      <div className="flex items-center gap-2">
        <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:0ms]" />
        <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:150ms]" />
        <div className="h-3 w-3 animate-bounce rounded-full bg-blue-500 [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function ResultView({
  isCorrect,
  correctAnswer,
  revealedChoices,
  labelPrefix,
}: {
  isCorrect: boolean | null;
  correctAnswer: string | null;
  revealedChoices: ({ id: number; label: string; is_correct: boolean })[] | null;
  labelPrefix?: string;
}) {
  const prefix = labelPrefix ? `${labelPrefix} — ` : '';
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      {isCorrect === true ? (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-green-600/20">
            <CheckCircle2 className="h-14 w-14 text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-green-400">{prefix}Bonne réponse !</h2>
        </>
      ) : isCorrect === false ? (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-600/20">
            <XCircle className="h-14 w-14 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-red-400">{prefix}Mauvaise réponse</h2>
        </>
      ) : (
        <>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-blue-600/20">
            <Shield className="h-14 w-14 text-blue-400" />
          </div>
          <h2 className="text-2xl font-bold">{prefix}Résultat</h2>
        </>
      )}

      {correctAnswer && (
        <p className="text-gray-400">
          La bonne réponse était :{' '}
          <span className="font-semibold text-white">{correctAnswer}</span>
        </p>
      )}

      {revealedChoices && revealedChoices.length > 0 && (
        <div className="grid w-full max-w-md gap-2">
          {revealedChoices.map((c) => (
            <div
              key={c.id}
              className={clsx(
                'rounded-lg border px-4 py-2 text-sm',
                c.is_correct
                  ? 'border-green-600 bg-green-600/10 text-green-400'
                  : 'border-gray-700 text-gray-500'
              )}
            >
              {c.label}
              {c.is_correct && <CheckCircle2 className="ml-2 inline h-4 w-4" />}
            </div>
          ))}
        </div>
      )}

      <p className="text-sm text-gray-500">La prochaine question arrive…</p>
    </div>
  );
}

function RoundSkippedView() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-orange-600/20">
        <SkipForward className="h-14 w-14 text-orange-400" />
      </div>
      <h2 className="text-2xl font-bold text-orange-400">Manche passée</h2>
      <p className="max-w-sm text-gray-400">
        Vous avez passé cette manche. Votre cagnotte a été transférée au jackpot.
        Vous rejoindrez la prochaine manche automatiquement.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-3 w-3 animate-bounce rounded-full bg-orange-500 [animation-delay:0ms]" />
        <div className="h-3 w-3 animate-bounce rounded-full bg-orange-500 [animation-delay:150ms]" />
        <div className="h-3 w-3 animate-bounce rounded-full bg-orange-500 [animation-delay:300ms]" />
      </div>
      <p className="text-sm text-gray-500">En attente de la prochaine manche…</p>
    </div>
  );
}

function EliminatedView({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-red-600/20">
        <XCircle className="h-14 w-14 text-red-400" />
      </div>
      <h2 className="text-2xl font-bold text-red-400">Éliminé</h2>
      <p className="max-w-sm text-gray-400">
        Vous avez été éliminé de la partie. Merci pour votre participation !
      </p>
      <Button variant="outline" onClick={onLogout} className="mt-4">
        <LogOut className="mr-2 h-4 w-4" />
        Quitter
      </Button>
    </div>
  );
}

function FinaleChoiceView({
  onChoice,
}: {
  onChoice: (choice: 'continue' | 'abandon') => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-amber-500">
        <Trophy className="h-14 w-14 text-white" />
      </div>
      <h2 className="text-3xl font-bold">La Finale</h2>
      <p className="max-w-md text-gray-400">
        Vous êtes finaliste ! Faites votre choix : tentez de gagner la totalité de la
        cagnotte ou sécurisez vos gains en abandonnant.
      </p>
      <div className="flex w-full max-w-sm gap-3">
        <Button
          onClick={() => onChoice('continue')}
          className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 py-6 text-lg hover:from-green-700 hover:to-emerald-700"
        >
          <Zap className="mr-2 h-5 w-5" />
          Continuer
        </Button>
        <Button
          onClick={() => onChoice('abandon')}
          variant="outline"
          className="flex-1 border-orange-600/50 py-6 text-lg text-orange-400 hover:bg-orange-600/10"
        >
          <Shield className="mr-2 h-5 w-5" />
          Abandonner
        </Button>
      </div>
    </div>
  );
}

function FinaleResultView({
  choices,
  scenario,
}: {
  choices: { session_player_id: number; choice: string; pseudo: string }[] | null;
  scenario: string | null;
}) {
  const continuers = choices?.filter((c) => c.choice === 'continue') ?? [];
  const abandoners = choices?.filter((c) => c.choice === 'abandon') ?? [];

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-amber-500">
        <Trophy className="h-14 w-14 text-white" />
      </div>
      <h2 className="text-3xl font-bold">Résultat du vote</h2>

      {scenario === 'all_abandon' && (
        <p className="text-lg text-orange-400">Tous les finalistes ont choisi d&apos;abandonner.</p>
      )}
      {scenario === 'all_continue' && (
        <p className="text-lg text-green-400">Tous les finalistes continuent !</p>
      )}
      {scenario === 'some_abandon' && (
        <p className="text-lg text-amber-400">Certains finalistes abandonnent.</p>
      )}

      {continuers.length > 0 && (
        <div className="w-full max-w-sm space-y-2">
          <p className="text-sm font-semibold text-green-400">Continuent</p>
          {continuers.map((c) => (
            <div key={c.session_player_id} className="rounded-lg border border-green-700/50 bg-green-900/20 px-4 py-2 text-green-300 font-medium">
              {c.pseudo}
            </div>
          ))}
        </div>
      )}

      {abandoners.length > 0 && (
        <div className="w-full max-w-sm space-y-2">
          <p className="text-sm font-semibold text-orange-400">Abandonnent</p>
          {abandoners.map((c) => (
            <div key={c.session_player_id} className="rounded-lg border border-orange-700/50 bg-orange-900/20 px-4 py-2 text-orange-300 font-medium">
              {c.pseudo}
            </div>
          ))}
        </div>
      )}

      {scenario !== 'all_abandon' && (
        <p className="text-sm text-gray-500">En attente de la question finale…</p>
      )}
    </div>
  );
}

function GameEndedView({
  winners,
  finalJackpot,
  onLogout,
}: {
  winners: { pseudo: string; final_gain: number }[] | null;
  finalJackpot: number | null;
  onLogout: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 shadow-xl shadow-yellow-500/20">
        <Trophy className="h-14 w-14 text-white" />
      </div>
      <h2 className="text-3xl font-bold">Partie terminée !</h2>

      {finalJackpot !== null && (
        <JackpotCounter amount={finalJackpot} size="lg" />
      )}

      {winners && winners.length > 0 && (
        <div className="mt-2 space-y-2">
          <p className="text-sm font-medium text-gray-400">
            {winners.length === 1 ? 'Gagnant' : 'Gagnants'}
          </p>
          {winners.map((w) => (
            <div key={w.pseudo} className="rounded-xl border border-yellow-600/30 bg-yellow-600/10 px-6 py-3">
              <p className="text-lg font-bold text-yellow-400">{w.pseudo}</p>
              <p className="text-sm text-gray-400">
                {new Intl.NumberFormat('fr-FR').format(w.final_gain)} pts gagnés
              </p>
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" onClick={onLogout} className="mt-4 border-gray-600 bg-transparent text-gray-300 hover:bg-gray-800">
        <LogOut className="mr-2 h-4 w-4" />
        Quitter
      </Button>
    </div>
  );
}

function DuelWaitingView({
  assignments,
  currentTurn,
  sessionPlayerId,
}: {
  assignments: { session_player_id: number; pseudo: string; turn_order: number; question_id: number }[];
  currentTurn: number;
  sessionPlayerId: number | null;
}) {
  const myAssignment = assignments.find(a => a.session_player_id === sessionPlayerId);
  const currentPlayer = assignments.find(a => a.turn_order === currentTurn);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-600/20 animate-pulse">
        <Swords className="h-10 w-10 text-amber-400" />
      </div>
      <h2 className="text-xl font-bold">Duel en cours</h2>
      {currentPlayer && (
        <p className="text-gray-400">
          C&apos;est au tour de <span className="font-semibold text-amber-400">{currentPlayer.pseudo}</span>
        </p>
      )}
      {myAssignment && (
        <div className="rounded-xl border border-amber-600/30 bg-amber-600/10 px-6 py-3">
          <p className="text-sm text-gray-400">Votre passage</p>
          <p className="text-2xl font-bold text-amber-400">Tour {myAssignment.turn_order}</p>
        </div>
      )}
      <div className="w-full max-w-xs space-y-2">
        {assignments.map((a) => (
          <div
            key={a.turn_order}
            className={clsx(
              'flex items-center gap-3 rounded-lg px-4 py-2 text-sm border',
              a.turn_order === currentTurn
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : a.turn_order < currentTurn
                  ? 'border-gray-700 bg-gray-800/50 text-gray-500 line-through'
                  : 'border-gray-700 text-gray-400'
            )}
          >
            <span className={clsx(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
              a.turn_order === currentTurn ? 'bg-amber-600' : 'bg-gray-700'
            )}>
              {a.turn_order}
            </span>
            <span className="font-medium">{a.pseudo}</span>
            {a.session_player_id === sessionPlayerId && (
              <span className="ml-auto text-xs text-blue-400">(vous)</span>
            )}
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-500">Attendez votre tour…</p>
    </div>
  );
}

function DuelDoneView({
  assignments,
  currentTurn,
}: {
  assignments: { session_player_id: number; pseudo: string; turn_order: number; question_id: number }[];
  currentTurn: number;
}) {
  const currentPlayer = assignments.find(a => a.turn_order === currentTurn);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-600/20">
        <CheckCircle2 className="h-10 w-10 text-green-400" />
      </div>
      <h2 className="text-xl font-bold text-green-400">Vous êtes passé !</h2>
      {currentPlayer && (
        <p className="text-gray-400">
          C&apos;est au tour de <span className="font-semibold text-amber-400">{currentPlayer.pseudo}</span>
        </p>
      )}
      <p className="text-sm text-gray-500">En attente des autres joueurs…</p>
    </div>
  );
}
