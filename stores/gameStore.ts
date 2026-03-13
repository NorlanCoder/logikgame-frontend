import { create } from 'zustand';
import type {
  Question,
  QuestionChoice,
  SessionPlayerStatus,
  WsQuestionLaunched,
  WsRoundStarted,
  WsGameEnded,
  WsSecondChanceLaunched,
  WsDuelQuestionsAssigned,
  RoundType,
} from '@/lib/types';


type DuelAssignment = WsDuelQuestionsAssigned['assignments'][number];

type PlayerGamePhase =
  | 'waiting'        // En attente du début ou d'une question
  | 'round_intro'    // Annonce de la manche
  | 'question'       // Question affichée, réponse possible
  | 'answered'       // Réponse envoyée, en attente du résultat
  | 'answer_revealed' // Bonne réponse affichée, en attente des résultats
  | 'result'         // Résultat affiché (correct/incorrect)
  | 'eliminated'     // Le joueur a été éliminé
  | 'round_skipped'  // Manche passée (manche 4), en attente de la suivante
  | 'duel_waiting'   // En attente de son tour (manches 6/7)
  | 'duel_done'      // Déjà passé (manches 6/7)
  | 'second_chance_danger'  // Mauvaise réponse en manche 3, en attente SC
  | 'second_chance_safe'    // Bonne réponse en manche 3, en attente question suivante
  | 'second_chance_waiting' // SC lancée, joueur safe attend
  | 'second_chance'  // Question seconde chance active
  | 'sc_answered'    // Réponse SC envoyée, en attente résultat
  | 'sc_answer_revealed' // Réponse SC révélée, en attente des résultats
  | 'sc_result'      // Résultat SC affiché
  | 'finale_choice'  // Choix finale (continuer/abandonner)
  | 'finale_result'  // Résultat des choix de la finale révélés
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

  // Finale (Manche 8)
  finaleFinalists: { session_player_id: number; pseudo: string }[] | null;
  finaleChoices: { session_player_id: number; choice: string; pseudo: string }[] | null;
  finaleScenario: string | null;
  finaleAbandoned: boolean;

  // Seconde chance (Manche 3)
  secondChanceQuestion: WsSecondChanceLaunched['question'] | null;
  mainQuestionId: number | null;
  inDangerCount: number;
  scCorrectAnswer: string | null;
  scRevealedChoices: (QuestionChoice & { is_correct: boolean })[] | null;
  scIsCorrect: boolean | null;

  // Duels (Manches 6/7)
  duelAssignments: DuelAssignment[];
  duelCurrentTurn: number;   // turn_order actuellement en cours

  // Actions
  setPhase: (phase: PlayerGamePhase) => void;
  setRound: (round: RoundInfo) => void;
  setQuestion: (question: WsQuestionLaunched['question']) => void;
  setSelectedChoice: (choiceId: number) => void;
  setAnswerValue: (value: string) => void;
  markAnswered: () => void;
  setResult: (isCorrect: boolean, correctAnswer: string) => void;
  setResultPending: (isCorrect: boolean, correctAnswer: string) => void;
  setRevealedChoices: (choices: (QuestionChoice & { is_correct: boolean })[]) => void;
  setTimer: (seconds: number) => void;
  updateJackpot: (jackpot: number, playersRemaining: number) => void;
  setEliminated: (players: { pseudo: string; reason: string }[]) => void;
  applyHint: (hint: { removed_choice_ids?: number[]; revealed_letters?: string[]; range_hint_text?: string; range_min?: number; range_max?: number; masked_answer?: string; time_penalty_seconds: number }) => void;
  setPlayerStatus: (status: SessionPlayerStatus) => void;
  setSessionPlayerId: (id: number) => void;
  setGameEnded: (finalJackpot: number, winners: WsGameEnded['winners']) => void;
  setSecondChanceQuestion: (question: WsSecondChanceLaunched['question'], failedPlayerIds: number[], mainQuestionId: number) => void;
  markScAnswered: () => void;
  setScResult: (isCorrect: boolean, correctAnswer: string) => void;
  setScResultPending: (isCorrect: boolean, correctAnswer: string) => void;
  setScRevealedChoices: (choices: (QuestionChoice & { is_correct: boolean })[], correctAnswer: string) => void;
  setDuelAssignments: (assignments: DuelAssignment[]) => void;
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

  finaleFinalists: null,
  finaleChoices: null,
  finaleScenario: null,
  finaleAbandoned: false,

  secondChanceQuestion: null,
  mainQuestionId: null,
  inDangerCount: 0,
  scCorrectAnswer: null,
  scRevealedChoices: null,
  scIsCorrect: null,

  duelAssignments: [],
  duelCurrentTurn: 0,

  setPhase: (phase) => set({ phase }),

  setRound: (round) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    // Le vote de la finale sera déclenché par l'admin via l'événement finale.vote.launched
    const nextPhase = 'round_intro';
    // round_skipped se réinitialise quand une nouvelle manche commence
    set({
      currentRound: round,
      phase: nextPhase,
      currentQuestion: null,
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      revealedChoices: null,
      eliminatedPlayers: [],
      hintUsed: false,
      hintAvailable: false,
      removedChoiceIds: [],
      revealedLetters: [],
      hintText: null,
      duelAssignments: [],
      duelCurrentTurn: 0,
    });
  },

  setQuestion: (question) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;

    // Manches duel (6/7) : seul le joueur assigné voit la question
    const isDuel = state.currentRound?.round_type === 'duel_jackpot' || state.currentRound?.round_type === 'duel_elimination';
    const assignedPlayerId = question.assigned_player_id ?? null;

    if (isDuel && assignedPlayerId) {
      const isMyTurn = assignedPlayerId === state.sessionPlayerId;
      // Trouver le turn_order courant
      const assignment = state.duelAssignments.find(a => a.question_id === question.id);
      const turnOrder = assignment?.turn_order ?? state.duelCurrentTurn + 1;

      if (isMyTurn) {
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
          inDangerCount: 0,
          scCorrectAnswer: null,
          scRevealedChoices: null,
          scIsCorrect: null,
          hintAvailable: false,
          removedChoiceIds: [],
          revealedLetters: [],
          hintText: null,
          duelCurrentTurn: turnOrder,
        });
      } else {
        // Pas mon tour — vérifier si j'ai déjà passé ou si j'attends
        const myAssignments = state.duelAssignments.filter(a => a.session_player_id === state.sessionPlayerId);
        const allMyTurnsDone = myAssignments.length > 0 && myAssignments.every(a => a.turn_order < turnOrder);
        set({
          currentQuestion: question,
          phase: allMyTurnsDone ? 'duel_done' : 'duel_waiting',
          duelCurrentTurn: turnOrder,
        });
      }
      return;
    }

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
      inDangerCount: 0,
      scCorrectAnswer: null,
      scRevealedChoices: null,
      scIsCorrect: null,
      // Ne pas reset hintUsed — l'indice est limité à 1 par manche, pas par question
      hintAvailable: false,
      removedChoiceIds: [],
      revealedLetters: [],
      hintText: null,
    });
  },

  setSelectedChoice: (choiceId) => set({ selectedChoiceId: choiceId }),
  setAnswerValue: (value) => set({ answerValue: value }),

  markAnswered: () => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    set({ hasAnswered: true, phase: 'answered' });
  },

  setResult: (isCorrect, correctAnswer) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    // En manche 3, si le reveal est déjà passé et qu'il y a des joueurs en danger,
    // aller directement en danger/safe au lieu de rester en 'result'
    if (
      state.currentRound?.round_type === 'second_chance' &&
      state.revealedChoices !== null &&
      state.inDangerCount > 0
    ) {
      set({
        isCorrect,
        correctAnswer,
        phase: isCorrect === false ? 'second_chance_danger' : 'second_chance_safe',
      });
    } else {
      set({ isCorrect, correctAnswer, phase: 'result' });
    }
  },

  setResultPending: (isCorrect, correctAnswer) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    set({ isCorrect, correctAnswer });
  },

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
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
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

  markScAnswered: () => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    set({ hasAnswered: true, phase: 'sc_answered' });
  },

  setScResult: (isCorrect, correctAnswer) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    set({ scIsCorrect: isCorrect, scCorrectAnswer: correctAnswer, phase: 'sc_result' });
  },

  setScResultPending: (isCorrect, correctAnswer) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    set({ scIsCorrect: isCorrect, scCorrectAnswer: correctAnswer });
  },

  setScRevealedChoices: (choices, correctAnswer) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    set({ scRevealedChoices: choices, scCorrectAnswer: correctAnswer });
  },

  setDuelAssignments: (assignments) => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
    // Trouver si mon prochain tour est le premier
    const myFirstAssignment = assignments.find(a => a.session_player_id === state.sessionPlayerId);
    set({
      duelAssignments: assignments,
      duelCurrentTurn: 0,
      phase: myFirstAssignment?.turn_order === 1 ? 'round_intro' : 'duel_waiting',
    });
  },

  resetQuestion: () => {
    const state = useGameStore.getState();
    if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;

    // En duel, après un reset question, rester dans le mode duel
    const isDuel = state.currentRound?.round_type === 'duel_jackpot' || state.currentRound?.round_type === 'duel_elimination';
    const nextPhase = isDuel && state.duelAssignments.length > 0 ? 'duel_waiting' : 'waiting';

    set({
      currentQuestion: null,
      selectedChoiceId: null,
      answerValue: '',
      hasAnswered: false,
      isCorrect: null,
      correctAnswer: null,
      revealedChoices: null,
      timerSeconds: 0,
      phase: nextPhase,
      eliminatedPlayers: [],
      secondChanceQuestion: null,
      mainQuestionId: null,
      inDangerCount: 0,
      scCorrectAnswer: null,
      scRevealedChoices: null,
      scIsCorrect: null,
    });
  },

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
      finaleFinalists: null,
      finaleChoices: null,
      finaleScenario: null,
      finaleAbandoned: false,
      secondChanceQuestion: null,
      mainQuestionId: null,
      duelAssignments: [],
      duelCurrentTurn: 0,
    }),
}));
