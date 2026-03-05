import { create } from 'zustand';
import type {
  Question,
  QuestionChoice,
  SessionPlayerStatus,
  WsQuestionLaunched,
} from '@/lib/types';

type PlayerGamePhase =
  | 'waiting'
  | 'question'
  | 'answered'
  | 'result'
  | 'eliminated'
  | 'second_chance_waiting'
  | 'second_chance'
  | 'finale_choice'
  | 'game_ended';

interface GameState {
  // État global
  phase: PlayerGamePhase;
  jackpot: number;
  playersRemaining: number;
  timerSeconds: number;

  // Question en cours
  currentQuestion: WsQuestionLaunched['question'] | null;
  selectedChoiceId: number | null;
  answerValue: string;
  hasAnswered: boolean;
  isCorrect: boolean | null;
  correctAnswer: string | null;

  // Indice (Manche 2)
  hintUsed: boolean;
  hintAvailable: boolean;
  removedChoiceIds: number[];

  // Joueur
  playerStatus: SessionPlayerStatus;
  capital: number;
  personalJackpot: number;

  // Éliminés
  eliminatedPlayers: { pseudo: string; reason: string }[];

  // Actions
  setPhase: (phase: PlayerGamePhase) => void;
  setQuestion: (question: WsQuestionLaunched['question']) => void;
  setSelectedChoice: (choiceId: number) => void;
  setAnswerValue: (value: string) => void;
  markAnswered: () => void;
  setResult: (isCorrect: boolean, correctAnswer: string) => void;
  setTimer: (seconds: number) => void;
  updateJackpot: (jackpot: number, playersRemaining: number) => void;
  setEliminated: (players: { pseudo: string; reason: string }[]) => void;
  applyHint: (removedChoiceIds: number[]) => void;
  setPlayerStatus: (status: SessionPlayerStatus) => void;
  resetQuestion: () => void;
  resetGame: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  phase: 'waiting',
  jackpot: 0,
  playersRemaining: 0,
  timerSeconds: 0,

  currentQuestion: null,
  selectedChoiceId: null,
  answerValue: '',
  hasAnswered: false,
  isCorrect: null,
  correctAnswer: null,

  hintUsed: false,
  hintAvailable: false,
  removedChoiceIds: [],

  playerStatus: 'waiting',
  capital: 1000,
  personalJackpot: 0,

  eliminatedPlayers: [],

  setPhase: (phase) => set({ phase }),

  setQuestion: (question) =>
    set({
      currentQuestion: question,
      phase: 'question',
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      timerSeconds: question.duration,
      eliminatedPlayers: [],
    }),

  setSelectedChoice: (choiceId) => set({ selectedChoiceId: choiceId }),
  setAnswerValue: (value) => set({ answerValue: value }),

  markAnswered: () => set({ hasAnswered: true, phase: 'answered' }),

  setResult: (isCorrect, correctAnswer) =>
    set({ isCorrect, correctAnswer, phase: 'result' }),

  setTimer: (seconds) => set({ timerSeconds: seconds }),

  updateJackpot: (jackpot, playersRemaining) =>
    set({ jackpot, playersRemaining }),

  setEliminated: (players) => set({ eliminatedPlayers: players }),

  applyHint: (removedChoiceIds) =>
    set({ hintUsed: true, hintAvailable: false, removedChoiceIds }),

  setPlayerStatus: (status) => set({ playerStatus: status }),

  resetQuestion: () =>
    set({
      currentQuestion: null,
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      timerSeconds: 0,
      phase: 'waiting',
      eliminatedPlayers: [],
    }),

  resetGame: () =>
    set({
      phase: 'waiting',
      jackpot: 0,
      playersRemaining: 0,
      timerSeconds: 0,
      currentQuestion: null,
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      hintUsed: false,
      hintAvailable: false,
      removedChoiceIds: [],
      playerStatus: 'waiting',
      capital: 1000,
      personalJackpot: 0,
      eliminatedPlayers: [],
    }),
}));
