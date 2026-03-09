import { create } from 'zustand';
import type {
  Question,
  QuestionChoice,
  SessionPlayerStatus,
  WsQuestionLaunched,
  WsRoundStarted,
  WsGameEnded,
  WsSecondChanceLaunched,
  RoundType,
} from '@/lib/types';

type PlayerGamePhase =
  | 'waiting'        // En attente du début ou d'une question
  | 'round_intro'    // Annonce de la manche
  | 'question'       // Question affichée, réponse possible
  | 'answered'       // Réponse envoyée, en attente du résultat
  | 'result'         // Résultat affiché (correct/incorrect)
  | 'eliminated'     // Le joueur a été éliminé
  | 'round_skipped'  // Manche passée (manche 4), en attente de la suivante
  | 'second_chance_waiting' // En attente seconde chance
  | 'second_chance'  // Question seconde chance active
  | 'finale_choice'  // Choix finale (continuer/abandonner)
  | 'game_ended';    // Fin de partie

interface RoundInfo {
  round_number: number;
  name: string;
  round_type: RoundType;
  rules_description: string;
}

interface GameState {
  // État global
  phase: PlayerGamePhase;
  jackpot: number;
  playersRemaining: number;
  timerSeconds: number;

  // Manche en cours
  currentRound: RoundInfo | null;

  // Question en cours
  currentQuestion: WsQuestionLaunched['question'] | null;
  selectedChoiceId: number | null;
  answerValue: string;
  hasAnswered: boolean;
  isCorrect: boolean | null;
  correctAnswer: string | null;
  revealedChoices: (QuestionChoice & { is_correct: boolean })[] | null;

  // Indice (Manche 2)
  hintUsed: boolean;
  hintAvailable: boolean;
  removedChoiceIds: number[];
  revealedLetters: string[];
  hintText: string | null;

  // Joueur
  playerStatus: SessionPlayerStatus;
  capital: number;
  personalJackpot: number;
  sessionPlayerId: number | null;

  // Éliminés
  eliminatedPlayers: { pseudo: string; reason: string }[];

  // Fin de partie
  winners: WsGameEnded['winners'] | null;
  finalJackpot: number | null;

  // Seconde chance (Manche 3)
  secondChanceQuestion: WsSecondChanceLaunched['question'] | null;
  mainQuestionId: number | null;

  // Actions
  setPhase: (phase: PlayerGamePhase) => void;
  setRound: (round: RoundInfo) => void;
  setQuestion: (question: WsQuestionLaunched['question']) => void;
  setSelectedChoice: (choiceId: number) => void;
  setAnswerValue: (value: string) => void;
  markAnswered: () => void;
  setResult: (isCorrect: boolean, correctAnswer: string) => void;
  setRevealedChoices: (choices: (QuestionChoice & { is_correct: boolean })[]) => void;
  setTimer: (seconds: number) => void;
  updateJackpot: (jackpot: number, playersRemaining: number) => void;
  setEliminated: (players: { pseudo: string; reason: string }[]) => void;
  applyHint: (hint: { removed_choice_ids?: number[]; revealed_letters?: string[]; range_hint_text?: string; range_min?: number; range_max?: number; masked_answer?: string; time_penalty_seconds: number }) => void;
  setPlayerStatus: (status: SessionPlayerStatus) => void;
  setSessionPlayerId: (id: number) => void;
  setGameEnded: (finalJackpot: number, winners: WsGameEnded['winners']) => void;
  setSecondChanceQuestion: (question: WsSecondChanceLaunched['question'], failedPlayerIds: number[], mainQuestionId: number) => void;
  resetQuestion: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'waiting',
  jackpot: 0,
  playersRemaining: 0,
  timerSeconds: 0,

  currentRound: null,

  currentQuestion: null,
  selectedChoiceId: null,
  answerValue: '',
  hasAnswered: false,
  isCorrect: null,
  correctAnswer: null,
  revealedChoices: null,

  hintUsed: false,
  hintAvailable: false,
  removedChoiceIds: [],
  revealedLetters: [],
  hintText: null,

  playerStatus: 'waiting',
  capital: 1000,
  personalJackpot: 0,
  sessionPlayerId: null,

  eliminatedPlayers: [],

  winners: null,
  finalJackpot: null,

  secondChanceQuestion: null,
  mainQuestionId: null,

  setPhase: (phase) => set({ phase }),

  setRound: (round) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    // round_skipped se réinitialise quand une nouvelle manche commence
    set({
      currentRound: round,
      phase: 'round_intro',
      currentQuestion: null,
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      revealedChoices: null,
      eliminatedPlayers: [],
    });
  },

  setQuestion: (question) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;
    set({
      currentQuestion: question,
      phase: 'question',
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      revealedChoices: null,
      timerSeconds: question.duration,
      eliminatedPlayers: [],
      secondChanceQuestion: null,
      mainQuestionId: null,
    });
  },

  setSelectedChoice: (choiceId) => set({ selectedChoiceId: choiceId }),
  setAnswerValue: (value) => set({ answerValue: value }),

  markAnswered: () => set({ hasAnswered: true, phase: 'answered' }),

  setResult: (isCorrect, correctAnswer) =>
    set({ isCorrect, correctAnswer, phase: 'result' }),

  setRevealedChoices: (choices) => set({ revealedChoices: choices }),

  setTimer: (seconds) => set({ timerSeconds: seconds }),

  updateJackpot: (jackpot, playersRemaining) =>
    set({ jackpot, playersRemaining }),

  setEliminated: (players) => set({ eliminatedPlayers: players }),

  applyHint: (hint) => {
    const update: Partial<GameState> = { hintUsed: true, hintAvailable: false };
    if (hint.removed_choice_ids) update.removedChoiceIds = hint.removed_choice_ids;
    if (hint.revealed_letters) update.revealedLetters = hint.revealed_letters;
    // Indice nombre : construire le texte à partir des bornes
    if (hint.range_min != null && hint.range_max != null) {
      update.hintText = `La réponse est entre ${Number(hint.range_min)} et ${Number(hint.range_max)}`;
    } else if (hint.range_hint_text) {
      update.hintText = hint.range_hint_text;
    }
    if (hint.revealed_letters?.length) {
      update.hintText = hint.masked_answer ?? `Lettres révélées : ${hint.revealed_letters.join(', ')}`;
    }
    // Appliquer la pénalité de temps
    if (hint.time_penalty_seconds > 0) {
      const currentTimer = useGameStore.getState().timerSeconds;
      update.timerSeconds = Math.max(0, currentTimer - hint.time_penalty_seconds);
    }
    set(update);
  },

  setPlayerStatus: (status) =>
    set({
      playerStatus: status,
      ...(status === 'eliminated' ? { phase: 'eliminated' as const } : {}),
    }),

  setSessionPlayerId: (id) => set({ sessionPlayerId: id }),

  setGameEnded: (finalJackpot, winners) =>
    set({ finalJackpot, winners, phase: 'game_ended' }),

  setSecondChanceQuestion: (question, failedPlayerIds, mainQuestionId) => {
    const state = useGameStore.getState();
    const isFailed = failedPlayerIds.includes(state.sessionPlayerId ?? -1);
    set({
      secondChanceQuestion: question,
      mainQuestionId,
      phase: isFailed ? 'second_chance' : 'second_chance_waiting',
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      timerSeconds: question.duration,
    });
  },

  resetQuestion: () =>
    set({
      currentQuestion: null,
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      revealedChoices: null,
      timerSeconds: 0,
      phase: 'waiting',
      eliminatedPlayers: [],
      secondChanceQuestion: null,
      mainQuestionId: null,
    }),

  resetGame: () =>
    set({
      phase: 'waiting',
      jackpot: 0,
      playersRemaining: 0,
      timerSeconds: 0,
      currentRound: null,
      currentQuestion: null,
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      revealedChoices: null,
      hintUsed: false,
      hintAvailable: false,
      removedChoiceIds: [],
      revealedLetters: [],
      hintText: null,
      playerStatus: 'waiting',
      capital: 1000,
      personalJackpot: 0,
      sessionPlayerId: null,
      eliminatedPlayers: [],
      winners: null,
      finalJackpot: null,
      secondChanceQuestion: null,
      mainQuestionId: null,
    }),
}));
