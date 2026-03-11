'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  ROUND_TYPE_LABELS,
  ELIMINATION_REASON_LABELS,
  PLAYER_STATUS_LABELS,
} from '@/lib/constants';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  Users,
  Trophy,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lightbulb,
  SkipForward,
  Swords,
  Target,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface RecapPlayer {
  id: number;
  pseudo: string;
  full_name: string;
  status: string;
  capital: number;
  personal_jackpot: number;
  final_gain: number | null;
  elimination_reason: string | null;
  eliminated_in_round_id: number | null;
}

interface PlayerAnswer {
  session_player_id: number;
  pseudo: string;
  answer_value: string | null;
  selected_choice: string | null;
  is_correct: boolean;
  hint_used: boolean;
  response_time_ms: number;
  is_timeout: boolean;
}

interface QuestionElimination {
  session_player_id: number;
  pseudo: string;
  reason: string;
  capital_transferred: number;
}

interface QuestionData {
  id: number;
  text: string;
  answer_type: string;
  correct_answer: string;
  display_order: number;
  status: string;
  assigned_player_id: number | null;
  assigned_player_pseudo: string | null;
  has_second_chance: boolean;
  second_chance_text: string | null;
  second_chance_correct: string | null;
  stats: {
    total_answers: number;
    correct_count: number;
    wrong_count: number;
    timeout_count: number;
    hint_used_count: number;
    avg_response_time_ms: number;
    sc_total: number;
    sc_correct: number;
  };
  player_answers: PlayerAnswer[];
  sc_player_answers: PlayerAnswer[];
  hint_users: { session_player_id: number; pseudo: string }[];
  eliminations: QuestionElimination[];
}

interface RoundSkipEntry {
  session_player_id: number;
  pseudo: string;
  capital_lost: number;
}

interface RoundElimination {
  session_player_id: number;
  pseudo: string;
  reason: string;
  question_id: number | null;
  capital_transferred: number;
}

interface RankingEntry {
  session_player_id: number;
  pseudo: string;
  rank: number;
  correct_answers_count: number;
  total_response_time_ms: number;
  is_qualified: boolean;
}

interface RoundData {
  id: number;
  round_number: number;
  round_type: string;
  name: string;
  status: string;
  questions: QuestionData[];
  eliminations: RoundElimination[];
  round_skips: RoundSkipEntry[];
  rankings: RankingEntry[];
}

interface FinaleData {
  choices: {
    session_player_id: number;
    pseudo: string;
    choice: string;
  }[];
  results: {
    session_player_id: number;
    pseudo: string;
    finale_scenario: string;
    final_gain: number;
    is_winner: boolean;
    position: number;
  }[];
}

interface RecapData {
  session: {
    id: number;
    name: string;
    status: string;
    jackpot: number;
    players_remaining: number;
    started_at: string | null;
    ended_at: string | null;
  };
  players: RecapPlayer[];
  rounds: RoundData[];
  finale: FinaleData;
}

// ── Helpers ──────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (!ms) return '-';
  return (ms / 1000).toFixed(1) + 's';
}

function AnswerBadge({ correct, timeout }: { correct: boolean; timeout: boolean }) {
  if (timeout) return <Badge variant="outline" className="bg-orange-900/30 text-orange-400 border-orange-600"><AlertCircle className="mr-1 h-3 w-3" />Timeout</Badge>;
  if (correct) return <Badge variant="outline" className="bg-green-900/30 text-green-400 border-green-600"><CheckCircle className="mr-1 h-3 w-3" />Correct</Badge>;
  return <Badge variant="outline" className="bg-red-900/30 text-red-400 border-red-600"><XCircle className="mr-1 h-3 w-3" />Faux</Badge>;
}

function StatusBadgePlayer({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-900/30 text-green-400 border-green-600',
    eliminated: 'bg-red-900/30 text-red-400 border-red-600',
    finalist: 'bg-blue-900/30 text-blue-400 border-blue-600',
    finalist_winner: 'bg-yellow-900/30 text-yellow-400 border-yellow-600',
    finalist_loser: 'bg-gray-700/30 text-gray-400 border-gray-600',
    abandoned: 'bg-gray-700/30 text-gray-400 border-gray-600',
  };
  return (
    <Badge variant="outline" className={colors[status] || 'bg-gray-700/30 text-gray-400 border-gray-600'}>
      {PLAYER_STATUS_LABELS[status] || status}
    </Badge>
  );
}

// ── Collapsible Section ──────────────────────────────────────

function CollapsibleSection({
  title,
  icon,
  count,
  children,
  defaultOpen = false,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-800/50 hover:bg-gray-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title}
          {count !== undefined && (
            <Badge variant="secondary" className="ml-1 text-xs">{count}</Badge>
          )}
        </div>
        {open ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="p-4">{children}</div>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function AdminRecapPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<RecapData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecap = async () => {
      try {
        const res = await api.get(`/admin/sessions/${id}/recap`);
        setData(res.data);
      } catch {
        // on error, data stays null
      } finally {
        setLoading(false);
      }
    };
    fetchRecap();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-gray-400">
        Impossible de charger le récapitulatif.
      </div>
    );
  }

  const { session, players, rounds, finale } = data;

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/admin/sessions/${id}`}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Récapitulatif — {session.name}</h1>
          <p className="text-sm text-gray-400">
            {session.started_at
              ? `Démarré le ${new Date(session.started_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
              : 'Non démarré'}
            {session.ended_at && ` • Terminé le ${new Date(session.ended_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
          </p>
        </div>
      </div>

      {/* Session Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-2xl font-bold">{players.length}</p>
              <p className="text-xs text-gray-400">Joueurs total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-2xl font-bold">{session.jackpot?.toLocaleString('fr-FR')} €</p>
              <p className="text-xs text-gray-400">Cagnotte finale</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Target className="h-5 w-5 text-green-400" />
            <div>
              <p className="text-2xl font-bold">{rounds.reduce((sum, r) => sum + r.questions.length, 0)}</p>
              <p className="text-xs text-gray-400">Questions posées</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-5 w-5 text-red-400" />
            <div>
              <p className="text-2xl font-bold">{players.filter(p => p.status === 'eliminated').length}</p>
              <p className="text-xs text-gray-400">Éliminés</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Players Overview */}
      <CollapsibleSection
        title="Joueurs"
        icon={<Users className="h-4 w-4 text-blue-400" />}
        count={players.length}
        defaultOpen={false}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pseudo</TableHead>
              <TableHead>Nom complet</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Capital</TableHead>
              <TableHead className="text-right">Jackpot perso</TableHead>
              <TableHead className="text-right">Gain final</TableHead>
              <TableHead>Raison d&apos;élimination</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{player.pseudo}</TableCell>
                <TableCell className="text-gray-400">{player.full_name}</TableCell>
                <TableCell><StatusBadgePlayer status={player.status} /></TableCell>
                <TableCell className="text-right">{player.capital}</TableCell>
                <TableCell className="text-right">{player.personal_jackpot}</TableCell>
                <TableCell className="text-right font-medium">
                  {player.final_gain !== null ? `${player.final_gain} €` : '-'}
                </TableCell>
                <TableCell>
                  {player.elimination_reason
                    ? ELIMINATION_REASON_LABELS[player.elimination_reason] || player.elimination_reason
                    : '-'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleSection>

      {/* Rounds */}
      {rounds.map((round) => (
        <RoundSection key={round.id} round={round} sessionId={id} />
      ))}

      {/* Finale */}
      {(finale.choices.length > 0 || finale.results.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-400" />
              Résultats Finale
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {finale.choices.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Choix des finalistes</h4>
                <div className="flex flex-wrap gap-2">
                  {finale.choices.map((c) => (
                    <Badge
                      key={c.session_player_id}
                      variant="outline"
                      className={
                        c.choice === 'continue'
                          ? 'bg-green-900/30 text-green-400 border-green-600'
                          : 'bg-red-900/30 text-red-400 border-red-600'
                      }
                    >
                      {c.pseudo}: {c.choice === 'continue' ? 'Continuer' : 'Abandonner'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {finale.results.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-2">Classement final</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Position</TableHead>
                      <TableHead>Joueur</TableHead>
                      <TableHead>Scénario</TableHead>
                      <TableHead className="text-right">Gain</TableHead>
                      <TableHead>Gagnant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {finale.results.map((r) => (
                      <TableRow key={r.session_player_id}>
                        <TableCell>
                          {r.position === 1 && <span className="text-yellow-400 font-bold">🥇 1er</span>}
                          {r.position === 2 && <span className="text-gray-300">🥈 2ème</span>}
                          {r.position === 3 && <span className="text-orange-400">🥉 3ème</span>}
                          {r.position > 3 && <span className="text-gray-400">{r.position}ème</span>}
                        </TableCell>
                        <TableCell className="font-medium">{r.pseudo}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r.finale_scenario}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-green-400">
                          {r.final_gain?.toLocaleString('fr-FR')} €
                        </TableCell>
                        <TableCell>
                          {r.is_winner && (
                            <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-600">
                              <Trophy className="mr-1 h-3 w-3" />
                              Gagnant
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Round Section ────────────────────────────────────────────

function RoundSection({ round }: { round: RoundData; sessionId: string }) {
  const totalCorrect = round.questions.reduce((s, q) => s + q.stats.correct_count, 0);
  const totalAnswers = round.questions.reduce((s, q) => s + q.stats.total_answers, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">Manche {round.round_number}</Badge>
            <span>{round.name || ROUND_TYPE_LABELS[round.round_type] || round.round_type}</span>
          </div>
          <div className="flex items-center gap-3 text-sm font-normal text-gray-400">
            <span>{round.questions.length} question{round.questions.length > 1 ? 's' : ''}</span>
            <Separator orientation="vertical" className="h-4" />
            <span className="text-green-400">{totalCorrect}/{totalAnswers} correctes</span>
            {round.eliminations.length > 0 && (
              <>
                <Separator orientation="vertical" className="h-4" />
                <span className="text-red-400">{round.eliminations.length} éliminé{round.eliminations.length > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Round skips */}
        {round.round_skips.length > 0 && (
          <CollapsibleSection
            title="Passages de manche"
            icon={<SkipForward className="h-4 w-4 text-orange-400" />}
            count={round.round_skips.length}
          >
            <div className="flex flex-wrap gap-2">
              {round.round_skips.map((rs) => (
                <Badge
                  key={rs.session_player_id}
                  variant="outline"
                  className="bg-orange-900/20 text-orange-400 border-orange-700"
                >
                  {rs.pseudo} (−{rs.capital_lost})
                </Badge>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Rankings */}
        {round.rankings.length > 0 && (
          <CollapsibleSection
            title="Classement de la manche"
            icon={<Trophy className="h-4 w-4 text-yellow-400" />}
            count={round.rankings.length}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rang</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead className="text-right">Bonnes réponses</TableHead>
                  <TableHead className="text-right">Temps total</TableHead>
                  <TableHead>Qualifié</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {round.rankings.map((r) => (
                  <TableRow key={r.session_player_id} className={!r.is_qualified ? 'opacity-50' : ''}>
                    <TableCell className="font-bold">{r.rank}</TableCell>
                    <TableCell className="font-medium">{r.pseudo}</TableCell>
                    <TableCell className="text-right">{r.correct_answers_count}</TableCell>
                    <TableCell className="text-right">{formatMs(r.total_response_time_ms)}</TableCell>
                    <TableCell>
                      {r.is_qualified
                        ? <CheckCircle className="h-4 w-4 text-green-400" />
                        : <XCircle className="h-4 w-4 text-red-400" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CollapsibleSection>
        )}

        {/* Round eliminations summary */}
        {round.eliminations.length > 0 && (
          <CollapsibleSection
            title="Éliminations de la manche"
            icon={<XCircle className="h-4 w-4 text-red-400" />}
            count={round.eliminations.length}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Raison</TableHead>
                  <TableHead className="text-right">Capital transféré</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {round.eliminations.map((e) => (
                  <TableRow key={`${e.session_player_id}-${e.question_id}`}>
                    <TableCell className="font-medium">{e.pseudo}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-700">
                        {ELIMINATION_REASON_LABELS[e.reason] || e.reason}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{e.capital_transferred}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CollapsibleSection>
        )}

        <Separator className="my-2" />

        {/* Questions detail */}
        {round.questions.map((question, qi) => (
          <QuestionSection key={question.id} question={question} index={qi + 1} roundType={round.round_type} />
        ))}
      </CardContent>
    </Card>
  );
}

// ── Question Section ─────────────────────────────────────────

function QuestionSection({
  question,
  index,
  roundType,
}: {
  question: QuestionData;
  index: number;
  roundType: string;
}) {
  const { stats } = question;

  return (
    <CollapsibleSection
      title={`Q${index}. ${question.text}`}
      icon={
        (roundType === 'duel_jackpot' || roundType === 'duel_elimination') && question.assigned_player_pseudo
          ? <Swords className="h-4 w-4 text-purple-400" />
          : undefined
      }
      count={stats.total_answers}
      defaultOpen={false}
    >
      <div className="space-y-4">
        {/* Question metadata */}
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-400">
            <Target className="h-3 w-3" />
            Réponse : <span className="text-white font-medium ml-1">{question.correct_answer}</span>
          </div>
          {question.assigned_player_pseudo && (
            <div className="flex items-center gap-1 text-purple-400">
              <Swords className="h-3 w-3" />
              Assignée à : <span className="font-medium ml-1">{question.assigned_player_pseudo}</span>
            </div>
          )}
        </div>

        {/* Stats bar */}
        <div className="flex flex-wrap gap-3 text-xs">
          <Badge variant="outline" className="bg-green-900/20 text-green-400 border-green-700">
            <CheckCircle className="mr-1 h-3 w-3" />{stats.correct_count} correct{stats.correct_count > 1 ? 's' : ''}
          </Badge>
          <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-700">
            <XCircle className="mr-1 h-3 w-3" />{stats.wrong_count} faux
          </Badge>
          <Badge variant="outline" className="bg-orange-900/20 text-orange-400 border-orange-700">
            <AlertCircle className="mr-1 h-3 w-3" />{stats.timeout_count} timeout
          </Badge>
          {stats.hint_used_count > 0 && (
            <Badge variant="outline" className="bg-yellow-900/20 text-yellow-400 border-yellow-700">
              <Lightbulb className="mr-1 h-3 w-3" />{stats.hint_used_count} indice{stats.hint_used_count > 1 ? 's' : ''}
            </Badge>
          )}
          <Badge variant="outline" className="text-gray-400 border-gray-600">
            <Clock className="mr-1 h-3 w-3" />Moy. {formatMs(stats.avg_response_time_ms)}
          </Badge>
        </div>

        {/* Player answers table */}
        {question.player_answers.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Joueur</TableHead>
                <TableHead>Réponse</TableHead>
                <TableHead>Résultat</TableHead>
                <TableHead className="text-right">Temps</TableHead>
                <TableHead>Indice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {question.player_answers.map((pa) => (
                <TableRow key={pa.session_player_id}>
                  <TableCell className="font-medium">{pa.pseudo}</TableCell>
                  <TableCell className="text-gray-300">
                    {pa.is_timeout ? <span className="italic text-gray-500">Pas de réponse</span> : (pa.selected_choice || pa.answer_value || '-')}
                  </TableCell>
                  <TableCell>
                    <AnswerBadge correct={pa.is_correct} timeout={pa.is_timeout} />
                  </TableCell>
                  <TableCell className="text-right text-gray-400">{formatMs(pa.response_time_ms)}</TableCell>
                  <TableCell>
                    {pa.hint_used && (
                      <Lightbulb className="h-4 w-4 text-yellow-400" />
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Second chance section */}
        {question.has_second_chance && question.sc_player_answers.length > 0 && (
          <div className="mt-3 border-t border-gray-700 pt-3">
            <h5 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-1">
              <Target className="h-3 w-3" />
              Seconde chance — {question.second_chance_text}
            </h5>
            <p className="text-xs text-gray-400 mb-2">
              Réponse correcte : <span className="text-white">{question.second_chance_correct}</span>
              {' • '}{stats.sc_correct}/{stats.sc_total} correct{stats.sc_correct > 1 ? 's' : ''}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Réponse</TableHead>
                  <TableHead>Résultat</TableHead>
                  <TableHead className="text-right">Temps</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {question.sc_player_answers.map((pa) => (
                  <TableRow key={pa.session_player_id}>
                    <TableCell className="font-medium">{pa.pseudo}</TableCell>
                    <TableCell className="text-gray-300">
                      {pa.is_timeout ? <span className="italic text-gray-500">Pas de réponse</span> : (pa.selected_choice || pa.answer_value || '-')}
                    </TableCell>
                    <TableCell>
                      <AnswerBadge correct={pa.is_correct} timeout={pa.is_timeout} />
                    </TableCell>
                    <TableCell className="text-right text-gray-400">{formatMs(pa.response_time_ms)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Eliminations on this question */}
        {question.eliminations.length > 0 && (
          <div className="mt-3 border-t border-gray-700 pt-3">
            <h5 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1">
              <XCircle className="h-3 w-3" />
              Éliminés sur cette question
            </h5>
            <div className="flex flex-wrap gap-2">
              {question.eliminations.map((e) => (
                <Badge
                  key={e.session_player_id}
                  variant="outline"
                  className="bg-red-900/20 text-red-400 border-red-700"
                >
                  {e.pseudo} — {ELIMINATION_REASON_LABELS[e.reason] || e.reason}
                  {e.capital_transferred > 0 ? ` (+${e.capital_transferred} transféré)` : ''}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Hint users */}
        {question.hint_users.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-yellow-400 mt-2">
            <Lightbulb className="h-3 w-3" />
            Indice utilisé par : {question.hint_users.map(h => h.pseudo).join(', ')}
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
