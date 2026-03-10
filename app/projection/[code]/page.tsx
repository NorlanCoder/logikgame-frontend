'use client';

import { useEffect, useState, useRef, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useEcho } from '@/hooks/useEcho';
import { Timer } from '@/components/shared/Timer';
import { Loader2, Trophy, Users, Zap, CheckCircle2, XCircle, Shield } from 'lucide-react';
import type {
  QuestionChoice,
  WsQuestionLaunched,
  WsAnswerRevealed,
  WsQuestionClosed,
  WsPlayerEliminated,
  WsJackpotUpdated,
  WsRoundStarted,
  WsRoundEnded,
  WsTimerTick,
  WsGameEnded,
  WsSecondChanceLaunched,
  WsSecondChanceRevealed,
} from '@/lib/types';

// ─── Types locaux pour la projection ─────────────────────────

interface ProjectionState {
  sessionId: number | null;
  sessionName: string;
  status: string;
  jackpot: number;
  playersRemaining: number;
  currentRound: {
    round_number: number;
    name: string;
    round_type: string;
    rules_description: string;
  } | null;
  currentQuestion: {
    id: number;
    text: string;
    answer_type: string;
    media_url: string | null;
    media_type: string | null;
    duration: number;
    status: string;
    choices?: QuestionChoice[];
  } | null;
  correctAnswer: string | null;
  revealedChoices: (QuestionChoice & { is_correct: boolean })[] | null;
  eliminatedPlayers: { pseudo: string; reason?: string }[];
  questionStats: { answers_received: number; correct_count: number; eliminated_count: number; in_danger_count: number; in_danger_players: string[] } | null;
  phase: 'waiting' | 'round_intro' | 'question' | 'question_closed' | 'answer_revealed' | 'eliminated' | 'game_ended' | 'sc_question' | 'sc_closed' | 'sc_revealed';
  winners: { pseudo: string; final_gain: number }[];
  scQuestion: {
    id: number;
    text: string;
    answer_type: string;
    media_url: string | null;
    media_type: string;
    duration: number;
    choices?: QuestionChoice[];
  } | null;
  scCorrectAnswer: string | null;
  scRevealedChoices: (QuestionChoice & { is_correct: boolean })[] | null;
}

const initialState: ProjectionState = {
  sessionId: null,
  sessionName: '',
  status: 'draft',
  jackpot: 0,
  playersRemaining: 0,
  currentRound: null,
  currentQuestion: null,
  correctAnswer: null,
  revealedChoices: null,
  eliminatedPlayers: [],
  questionStats: null,
  phase: 'waiting',
  winners: [],
  scQuestion: null,
  scCorrectAnswer: null,
  scRevealedChoices: null,
};

export default function ProjectionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  const router = useRouter();
  const echo = useEcho();
  const [error, setError] = useState('');
  const [state, setState] = useState<ProjectionState>(initialState);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerTotal, setTimerTotal] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subscribedRef = useRef<number | null>(null);

  // ─── Timer local ────────────────────────────────────────────

  const stopCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (duration: number) => {
      setTimerSeconds(duration);
      setTimerTotal(duration);
      stopCountdown();
      intervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev <= 1) {
            stopCountdown();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [stopCountdown],
  );

  useEffect(() => {
    return () => stopCountdown();
  }, [stopCountdown]);

  // ─── Auth + sync initial ────────────────────────────────────

  useEffect(() => {
    async function init() {
      try {
        const authRes = await api.post<{ session_id: number; session_name: string }>('/projection/authenticate', {
          access_code: code.toUpperCase(),
        });

        const syncRes = await api.get<{
          session: { id: number; name: string; status: string; jackpot: number; players_remaining: number };
          current_round: ProjectionState['currentRound'];
          current_question: ProjectionState['currentQuestion'] & { correct_answer?: string | null };
        }>(`/projection/${code.toUpperCase()}/sync`);

        const { session, current_round, current_question } = syncRes.data;

        let phase: ProjectionState['phase'] = 'waiting';
        if (current_question) {
          if (current_question.status === 'launched') phase = 'question';
          else if (current_question.status === 'closed') phase = 'question_closed';
          else if (current_question.status === 'revealed') phase = 'answer_revealed';
        } else if (current_round) {
          phase = 'round_intro';
        }

        setState({
          ...initialState,
          sessionId: session.id,
          sessionName: session.name,
          status: session.status,
          jackpot: session.jackpot,
          playersRemaining: session.players_remaining,
          currentRound: current_round,
          currentQuestion: current_question,
          correctAnswer: current_question?.correct_answer ?? null,
          phase,
        });

        // Si une question est en cours, lancer le timer localement
        if (current_question?.status === 'launched') {
          startCountdown(current_question.duration);
        }
      } catch {
        setError("Code d'accès invalide ou expiré");
      }
    }
    init();
  }, [code, startCountdown]);

  // ─── WebSocket events ───────────────────────────────────────

  useEffect(() => {
    const sessionId = state.sessionId;
    if (!echo || !sessionId || subscribedRef.current === sessionId) return;

    subscribedRef.current = sessionId;
    const channelName = `session.${sessionId}`;
    const channel = echo.channel(channelName);

    channel
      .listen('.round.started', (e: WsRoundStarted) => {
        setState((prev) => ({
          ...prev,
          currentRound: {
            round_number: e.round_number,
            name: e.name,
            round_type: e.round_type,
            rules_description: e.rules_description,
          },
          currentQuestion: null,
          correctAnswer: null,
          revealedChoices: null,
          eliminatedPlayers: [],
          questionStats: null,
          scQuestion: null,
          scCorrectAnswer: null,
          scRevealedChoices: null,
          phase: 'round_intro',
        }));
        stopCountdown();
        setTimerSeconds(0);
      })
      .listen('.question.launched', (e: WsQuestionLaunched) => {
        setState((prev) => ({
          ...prev,
          currentQuestion: {
            id: e.question.id,
            text: e.question.text,
            answer_type: e.question.answer_type,
            media_url: e.question.media_url,
            media_type: e.question.media_type,
            duration: e.question.duration,
            status: 'launched',
            choices: e.question.choices,
          },
          correctAnswer: null,
          revealedChoices: null,
          eliminatedPlayers: [],
          questionStats: null,
          scQuestion: null,
          scCorrectAnswer: null,
          scRevealedChoices: null,
          phase: 'question',
        }));
        startCountdown(e.question.duration);
      })
      .listen('.question.closed', (e: WsQuestionClosed) => {
        stopCountdown();
        setTimerSeconds(0);
        setState((prev) => ({
          ...prev,
          phase: 'question_closed',
          questionStats: {
            answers_received: e.answers_received,
            correct_count: e.correct_count,
            eliminated_count: e.eliminated_count,
            in_danger_count: e.in_danger_count,
            in_danger_players: e.in_danger_players,
          },
        }));
      })
      .listen('.answer.revealed', (e: WsAnswerRevealed) => {
        setState((prev) => ({
          ...prev,
          correctAnswer: e.correct_answer,
          revealedChoices: e.choices ?? null,
          phase: 'answer_revealed',
        }));
      })
      .listen('.player.eliminated', (e: WsPlayerEliminated) => {
        setState((prev) => ({
          ...prev,
          eliminatedPlayers: e.eliminated,
          playersRemaining: e.players_remaining,
          jackpot: e.jackpot,
        }));
      })
      .listen('.jackpot.updated', (e: WsJackpotUpdated) => {
        setState((prev) => ({
          ...prev,
          jackpot: e.jackpot,
          playersRemaining: e.players_remaining,
        }));
      })
      .listen('.round.ended', (e: WsRoundEnded) => {
        stopCountdown();
        setState((prev) => ({
          ...prev,
          jackpot: e.jackpot,
          playersRemaining: e.players_remaining,
          currentQuestion: null,
          correctAnswer: null,
          revealedChoices: null,
          questionStats: null,
          phase: 'waiting',
        }));
      })
      .listen('.timer.tick', (e: WsTimerTick) => {
        setTimerSeconds(e.remaining_seconds);
      })
      .listen('.timer.expired', () => {
        stopCountdown();
        setTimerSeconds(0);
      })
      .listen('.game.ended', (e: WsGameEnded) => {
        stopCountdown();
        setState((prev) => ({
          ...prev,
          phase: 'game_ended',
          jackpot: e.final_jackpot,
          winners: e.winners,
        }));
      })
      .listen('.second_chance.launched', (e: WsSecondChanceLaunched) => {
        setState((prev) => ({
          ...prev,
          scQuestion: {
            id: e.question.id,
            text: e.question.text,
            answer_type: e.question.answer_type,
            media_url: e.question.media_url,
            media_type: e.question.media_type,
            duration: e.question.duration,
            choices: e.question.choices,
          },
          scCorrectAnswer: null,
          scRevealedChoices: null,
          phase: 'sc_question',
        }));
        startCountdown(e.question.duration);
      })
      .listen('.second_chance.closed', () => {
        stopCountdown();
        setTimerSeconds(0);
        setState((prev) => ({
          ...prev,
          phase: 'sc_closed',
        }));
      })
      .listen('.second_chance.revealed', (e: WsSecondChanceRevealed) => {
        setState((prev) => ({
          ...prev,
          scCorrectAnswer: e.correct_answer,
          scRevealedChoices: e.choices ?? null,
          phase: 'sc_revealed',
        }));
      });

    return () => {
      echo.leaveChannel(channelName);
      subscribedRef.current = null;
    };
  }, [echo, state.sessionId, startCountdown, stopCountdown]);

  // ─── Renders ────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-4xl font-extrabold tracking-tight">
          LOGIK <span className="text-blue-400">GAME</span>
        </h1>
        <p className="text-xl text-red-400">{error}</p>
        <button
          onClick={() => router.push('/projection/auth')}
          className="rounded-lg border border-gray-700 px-4 py-2 text-sm transition-colors hover:bg-gray-800"
        >
          Saisir un code manuellement
        </button>
      </div>
    );
  }

  if (!state.sessionId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-blue-400" />
        <p className="mt-4 text-xl text-gray-400">Connexion en cours...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Bandeau supérieur */}
      <header className="flex items-center justify-between border-b border-gray-800 px-8 py-4">
        <h1 className="text-2xl font-extrabold tracking-tight">
          LOGIK <span className="text-blue-400">GAME</span>
        </h1>
        <div className="flex items-center gap-6 text-lg">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" />
            <span className="font-bold">{state.playersRemaining}</span>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" />
            <span className="font-bold text-yellow-400">{state.jackpot.toLocaleString('fr-FR')} €</span>
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex flex-1 flex-col items-center justify-center p-8">
        {state.phase === 'game_ended' && <GameEndedView state={state} />}
        {state.phase === 'waiting' && <WaitingView state={state} />}
        {state.phase === 'round_intro' && <RoundIntroView state={state} />}
        {state.phase === 'question' && (
          <QuestionView state={state} timerSeconds={timerSeconds} timerTotal={timerTotal} />
        )}
        {state.phase === 'question_closed' && <QuestionClosedView state={state} />}
        {state.phase === 'answer_revealed' && <AnswerRevealedView state={state} />}
        {state.phase === 'sc_question' && (
          <ScQuestionView state={state} timerSeconds={timerSeconds} timerTotal={timerTotal} />
        )}
        {state.phase === 'sc_closed' && <ScClosedView state={state} />}
        {state.phase === 'sc_revealed' && <ScRevealedView state={state} />}
      </main>

      {/* Éliminés */}
      {state.eliminatedPlayers.length > 0 && (
        <footer className="border-t border-gray-800 px-8 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-red-400">Éliminés :</span>
            {state.eliminatedPlayers.map((p, i) => (
              <span key={i} className="rounded-full bg-red-900/40 px-3 py-1 text-sm text-red-300">
                {p.pseudo}
              </span>
            ))}
          </div>
        </footer>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function WaitingView({ state }: { state: ProjectionState }) {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <h2 className="text-4xl font-extrabold">{state.sessionName}</h2>
      <p className="text-xl text-gray-400">En attente du lancement...</p>
      <div className="flex items-center gap-2 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Session en préparation</span>
      </div>
    </div>
  );
}

function RoundIntroView({ state }: { state: ProjectionState }) {
  const round = state.currentRound;
  if (!round) return null;
  return (
    <div className="flex flex-col items-center gap-6 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-full bg-blue-600/20 px-6 py-2">
        <span className="text-lg font-semibold text-blue-400">
          Manche {round.round_number}
        </span>
      </div>
      <h2 className="text-5xl font-extrabold">{round.name}</h2>
      {round.rules_description && (
        <p className="max-w-2xl text-xl text-gray-400">{round.rules_description}</p>
      )}
    </div>
  );
}

function QuestionView({
  state,
  timerSeconds,
  timerTotal,
}: {
  state: ProjectionState;
  timerSeconds: number;
  timerTotal: number;
}) {
  const q = state.currentQuestion;
  if (!q) return null;
  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8">
      {/* Timer */}
      <Timer seconds={timerSeconds} total={timerTotal} size="lg" />

      {/* Media */}
      {q.media_url && (
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl">
          {q.media_type === 'image' ? (
            <img src={q.media_url} alt="" className="h-auto w-full object-contain" />
          ) : q.media_type === 'video' ? (
            <video src={q.media_url} autoPlay muted className="h-auto w-full" />
          ) : q.media_type === 'audio' ? (
            <audio src={q.media_url} autoPlay controls className="w-full" />
          ) : null}
        </div>
      )}

      {/* Question */}
      <h2 className="text-center text-4xl font-bold leading-tight">{q.text}</h2>

      {/* Choix QCM */}
      {q.answer_type === 'qcm' && q.choices && (
        <div className="grid w-full grid-cols-2 gap-4">
          {q.choices
            .sort((a, b) => a.display_order - b.display_order)
            .map((choice) => (
              <div
                key={choice.id}
                className="rounded-xl border border-gray-700 bg-gray-900/50 px-6 py-5 text-center text-2xl font-semibold"
              >
                {choice.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function QuestionClosedView({ state }: { state: ProjectionState }) {
  const q = state.currentQuestion;
  const stats = state.questionStats;
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      {q && <h2 className="text-3xl font-bold">{q.text}</h2>}
      <div className="rounded-2xl bg-gray-900/60 p-8">
        <Zap className="mx-auto mb-4 h-12 w-12 text-yellow-400" />
        <p className="text-2xl font-bold">Question terminée</p>
        {stats && (
          <>
            <div className="mt-4 flex gap-8 text-lg">
              <div>
                <span className="text-gray-400">Réponses : </span>
                <span className="font-bold">{stats.answers_received}</span>
              </div>
              <div>
                <span className="text-gray-400">Correctes : </span>
                <span className="font-bold text-green-400">{stats.correct_count}</span>
              </div>
              <div>
                <span className="text-gray-400">Éliminés : </span>
                <span className="font-bold text-red-400">{stats.eliminated_count}</span>
              </div>
            </div>
            {stats.in_danger_count > 0 && (
              <div className="mt-6 rounded-xl border border-orange-700/50 bg-orange-900/20 px-6 py-4">
                <p className="text-lg font-semibold text-orange-400">
                  ⚠️ En danger : {stats.in_danger_count} joueur{stats.in_danger_count > 1 ? 's' : ''}
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  {stats.in_danger_players.map((pseudo, i) => (
                    <span
                      key={i}
                      className="rounded-full bg-orange-900/40 px-3 py-1 text-sm font-medium text-orange-300"
                    >
                      {pseudo}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnswerRevealedView({ state }: { state: ProjectionState }) {
  const q = state.currentQuestion;
  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8">
      {q && <h2 className="text-center text-3xl font-bold">{q.text}</h2>}

      {/* Bonne réponse texte */}
      {state.correctAnswer && (
        <div className="flex items-center gap-3 rounded-xl bg-green-900/30 px-6 py-4 text-2xl font-bold text-green-400">
          <CheckCircle2 className="h-8 w-8" />
          {state.correctAnswer}
        </div>
      )}

      {/* Choix révélés */}
      {state.revealedChoices && (
        <div className="grid w-full grid-cols-2 gap-4">
          {state.revealedChoices
            .sort((a, b) => a.display_order - b.display_order)
            .map((choice) => (
              <div
                key={choice.id}
                className={`flex items-center justify-center gap-3 rounded-xl border-2 px-6 py-5 text-center text-2xl font-semibold ${
                  choice.is_correct
                    ? 'border-green-500 bg-green-900/30 text-green-300'
                    : 'border-red-500/50 bg-red-900/20 text-red-400/70'
                }`}
              >
                {choice.is_correct ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 shrink-0" />
                )}
                {choice.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ScQuestionView({
  state,
  timerSeconds,
  timerTotal,
}: {
  state: ProjectionState;
  timerSeconds: number;
  timerTotal: number;
}) {
  const q = state.scQuestion;
  if (!q) return null;
  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8">
      {/* Badge seconde chance */}
      <div className="flex items-center gap-2 rounded-full bg-purple-600/20 px-6 py-2">
        <Shield className="h-5 w-5 text-purple-400" />
        <span className="text-lg font-semibold text-purple-400">Seconde Chance</span>
      </div>

      {/* Timer */}
      <Timer seconds={timerSeconds} total={timerTotal} size="lg" />

      {/* Media */}
      {q.media_url && (
        <div className="w-full max-w-3xl overflow-hidden rounded-2xl">
          {q.media_type === 'image' ? (
            <img src={q.media_url} alt="" className="h-auto w-full object-contain" />
          ) : q.media_type === 'video' ? (
            <video src={q.media_url} autoPlay muted className="h-auto w-full" />
          ) : q.media_type === 'audio' ? (
            <audio src={q.media_url} autoPlay controls className="w-full" />
          ) : null}
        </div>
      )}

      {/* Question */}
      <h2 className="text-center text-4xl font-bold leading-tight">{q.text}</h2>

      {/* Choix QCM */}
      {q.answer_type === 'qcm' && q.choices && (
        <div className="grid w-full grid-cols-2 gap-4">
          {q.choices
            .sort((a, b) => a.display_order - b.display_order)
            .map((choice) => (
              <div
                key={choice.id}
                className="rounded-xl border border-purple-700/50 bg-purple-900/20 px-6 py-5 text-center text-2xl font-semibold"
              >
                {choice.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function ScClosedView({ state }: { state: ProjectionState }) {
  const q = state.scQuestion;
  return (
    <div className="flex flex-col items-center gap-8 text-center">
      <div className="flex items-center gap-2 rounded-full bg-purple-600/20 px-6 py-2">
        <Shield className="h-5 w-5 text-purple-400" />
        <span className="text-lg font-semibold text-purple-400">Seconde Chance</span>
      </div>
      {q && <h2 className="text-3xl font-bold">{q.text}</h2>}
      <div className="rounded-2xl bg-gray-900/60 p-8">
        <Zap className="mx-auto mb-4 h-12 w-12 text-purple-400" />
        <p className="text-2xl font-bold">Seconde chance terminée</p>
        <p className="mt-2 text-lg text-gray-400">En attente de la révélation…</p>
      </div>
    </div>
  );
}

function ScRevealedView({ state }: { state: ProjectionState }) {
  const q = state.scQuestion;
  return (
    <div className="flex w-full max-w-5xl flex-col items-center gap-8">
      <div className="flex items-center gap-2 rounded-full bg-purple-600/20 px-6 py-2">
        <Shield className="h-5 w-5 text-purple-400" />
        <span className="text-lg font-semibold text-purple-400">Seconde Chance — Résultat</span>
      </div>

      {q && <h2 className="text-center text-3xl font-bold">{q.text}</h2>}

      {/* Bonne réponse texte */}
      {state.scCorrectAnswer && (
        <div className="flex items-center gap-3 rounded-xl bg-green-900/30 px-6 py-4 text-2xl font-bold text-green-400">
          <CheckCircle2 className="h-8 w-8" />
          {state.scCorrectAnswer}
        </div>
      )}

      {/* Choix révélés */}
      {state.scRevealedChoices && (
        <div className="grid w-full grid-cols-2 gap-4">
          {state.scRevealedChoices
            .sort((a, b) => a.display_order - b.display_order)
            .map((choice) => (
              <div
                key={choice.id}
                className={`flex items-center justify-center gap-3 rounded-xl border-2 px-6 py-5 text-center text-2xl font-semibold ${
                  choice.is_correct
                    ? 'border-green-500 bg-green-900/30 text-green-300'
                    : 'border-red-500/50 bg-red-900/20 text-red-400/70'
                }`}
              >
                {choice.is_correct ? (
                  <CheckCircle2 className="h-6 w-6 shrink-0" />
                ) : (
                  <XCircle className="h-6 w-6 shrink-0" />
                )}
                {choice.label}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function GameEndedView({ state }: { state: ProjectionState }) {
  return (
    <div className="flex flex-col items-center gap-8 text-center animate-in fade-in duration-1000">
      <Trophy className="h-24 w-24 text-yellow-400" />
      <h2 className="text-5xl font-extrabold">Partie terminée !</h2>
      <p className="text-3xl font-bold text-yellow-400">
        Jackpot final : {state.jackpot.toLocaleString('fr-FR')} €
      </p>
      {state.winners.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-2xl font-semibold">
            {state.winners.length === 1 ? 'Gagnant' : 'Gagnants'}
          </h3>
          {state.winners.map((w, i) => (
            <div key={i} className="rounded-xl bg-yellow-900/20 px-8 py-4 text-2xl font-bold text-yellow-300">
              🏆 {w.pseudo} — {w.final_gain.toLocaleString('fr-FR')} €
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
