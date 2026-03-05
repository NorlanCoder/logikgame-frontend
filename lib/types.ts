// ============================================================
// LOGIK GAME — Types TypeScript
// Basé sur le FRONTEND_REFERENCE.md (API Resources + Enums)
// ============================================================

// ─── Enums / Statuts ─────────────────────────────────────────

export type SessionStatus =
  | 'draft'
  | 'registration_open'
  | 'registration_closed'
  | 'preselection'
  | 'ready'
  | 'in_progress'
  | 'paused'
  | 'ended'
  | 'cancelled';

export type SessionPlayerStatus =
  | 'waiting'
  | 'active'
  | 'eliminated'
  | 'finalist'
  | 'finalist_winner'
  | 'finalist_loser'
  | 'abandoned';

export type RoundType =
  | 'sudden_death'
  | 'hint'
  | 'second_chance'
  | 'round_skip'
  | 'top4_elimination'
  | 'duel_jackpot'
  | 'duel_elimination'
  | 'finale';

export type RoundStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type QuestionStatus = 'pending' | 'launched' | 'closed' | 'revealed';

export type AnswerType = 'qcm' | 'number' | 'text';

export type MediaType = 'none' | 'image' | 'video' | 'audio';

export type RegistrationStatus =
  | 'registered'
  | 'preselection_pending'
  | 'preselection_done'
  | 'selected'
  | 'rejected';

export type EliminationReason =
  | 'wrong_answer'
  | 'timeout'
  | 'second_chance_failed'
  | 'round_skip'
  | 'top4_cutoff'
  | 'duel_lost'
  | 'finale_lost'
  | 'manual';

export type HintType = 'remove_choices' | 'reveal_letters' | 'reduce_range';

export type FinaleChoiceType = 'continue' | 'abandon';

export type FinaleScenario =
  | 'both_continue_both_win'
  | 'both_continue_one_wins'
  | 'both_continue_both_fail'
  | 'one_abandons'
  | 'both_abandon';

export type JackpotTransactionType =
  | 'elimination'
  | 'round_skip'
  | 'round6_bonus'
  | 'round6_departure'
  | 'finale_win'
  | 'finale_share'
  | 'finale_abandon_share'
  | 'manual_adjustment';

// ─── Resources (réponses API) ────────────────────────────────

export interface Session {
  id: number;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  scheduled_at: string;
  max_players: number;
  status: SessionStatus;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  preselection_opens_at: string | null;
  preselection_closes_at: string | null;
  jackpot: number;
  players_remaining: number;
  reconnection_delay: number;
  projection_code: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  rounds_count: number;
  registrations_count: number;
  rounds?: SessionRound[];
  current_round?: SessionRound;
}

export interface SessionRound {
  id: number;
  session_id: number;
  round_number: number;
  round_type: RoundType;
  name: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  status: RoundStatus;
  started_at: string | null;
  ended_at: string | null;
  questions_count?: number;
  questions?: Question[];
}

export interface Question {
  id: number;
  session_round_id: number;
  text: string;
  answer_type: AnswerType;
  correct_answer?: string;
  number_is_decimal: boolean;
  duration: number;
  display_order: number;
  media_url: string | null;
  media_type: MediaType;
  status: QuestionStatus;
  launched_at: string | null;
  closed_at: string | null;
  choices?: QuestionChoice[];
  hint?: QuestionHint;
}

export interface QuestionChoice {
  id: number;
  label: string;
  is_correct?: boolean;
  display_order: number;
}

export interface QuestionHint {
  hint_type: HintType;
  time_penalty_seconds: number;
  removed_choice_ids?: number[];
  revealed_letters?: string[];
  range_hint_text?: string;
  range_min?: number;
  range_max?: number;
}

export interface Registration {
  id: number;
  session_id: number;
  player_id: number;
  status: RegistrationStatus;
  registered_at: string;
  player?: {
    full_name: string;
    email: string;
    phone: string;
    pseudo: string;
  };
  preselection_result?: {
    correct_answers_count: number;
    total_questions: number;
    total_response_time_ms: number;
    rank: number;
    is_selected: boolean;
  };
}

export interface SessionPlayer {
  id: number;
  session_id: number;
  player_id: number;
  status: SessionPlayerStatus;
  capital: number;
  personal_jackpot: number;
  final_gain: number;
  is_connected: boolean;
  eliminated_at: string | null;
  elimination_reason: string | null;
  eliminated_in_round_id: number | null;
  player?: Player;
}

export interface Player {
  id: number;
  full_name: string;
  email: string;
  pseudo: string;
  phone: string;
  avatar_url: string | null;
  created_at: string;
}

export interface PreselectionQuestion {
  id: number;
  text: string;
  answer_type: AnswerType;
  duration: number;
  display_order: number;
  media_url: string | null;
  media_type: MediaType;
  choices?: {
    id: number;
    label: string;
    display_order: number;
  }[];
}

export interface Admin {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
}

// ─── Request Bodies ──────────────────────────────────────────

export interface CreateSessionBody {
  name: string;
  scheduled_at: string;
  max_players: number;
  description?: string;
  cover_image_url?: string;
  registration_opens_at?: string;
  registration_closes_at?: string;
  preselection_opens_at?: string;
  preselection_closes_at?: string;
  reconnection_delay?: number;
}

export interface CreateQuestionBody {
  text: string;
  answer_type: AnswerType;
  correct_answer: string;
  duration: number;
  display_order: number;
  media_url?: string | null;
  media_type?: MediaType;
  number_is_decimal?: boolean;
  choices?: {
    label: string;
    is_correct: boolean;
    display_order: number;
  }[];
  hint?: {
    hint_type: HintType;
    time_penalty_seconds: number;
    removed_choice_ids?: number[];
    revealed_letters?: string[];
    range_hint_text?: string;
    range_min?: number;
    range_max?: number;
  };
}

export interface PlayerRegisterBody {
  session_id: number;
  full_name: string;
  email: string;
  phone: string;
  pseudo: string;
}

export interface PlayerAnswerBody {
  question_id: number;
  answer_value?: string;
  selected_choice_id?: number;
  response_time_ms: number;
  is_second_chance?: boolean;
  second_chance_question_id?: number;
  selected_sc_choice_id?: number;
}

export interface PreselectionSubmitBody {
  registration_token: string;
  answers: {
    preselection_question_id: number;
    answer_value?: string;
    selected_choice_id?: number;
    response_time_ms: number;
  }[];
}

// ─── WebSocket Payloads ──────────────────────────────────────

export interface WsQuestionLaunched {
  question: {
    id: number;
    text: string;
    answer_type: AnswerType;
    media_url: string | null;
    media_type: MediaType;
    duration: number;
    launched_at: string;
    choices?: QuestionChoice[];
  };
}

export interface WsAnswerResult {
  question_id: number;
  is_correct: boolean;
  correct_answer: string;
}

export interface WsAnswerRevealed {
  question_id: number;
  correct_answer: string;
  choices?: (QuestionChoice & { is_correct: boolean })[];
}

export interface WsQuestionClosed {
  question_id: number;
  answers_received: number;
  correct_count: number;
  eliminated_count: number;
}

export interface WsPlayerEliminated {
  eliminated: { pseudo: string; reason: EliminationReason }[];
  players_remaining: number;
  jackpot: number;
}

export interface WsJackpotUpdated {
  jackpot: number;
  players_remaining: number;
}

export interface WsRoundStarted {
  round_number: number;
  name: string;
  round_type: RoundType;
  rules_description: string;
}

export interface WsRoundEnded {
  round_number: number;
  name: string;
  players_remaining: number;
  jackpot: number;
}

export interface WsTimerTick {
  question_id: number;
  remaining_seconds: number;
}

export interface WsTimerExpired {
  question_id: number;
}

export interface WsHintApplied {
  question_id: number;
  hint: {
    hint_type: HintType;
    removed_choice_ids?: number[];
    time_penalty_seconds: number;
  };
}

export interface WsGameEnded {
  final_jackpot: number;
  winners: { pseudo: string; final_gain: number }[];
}

// ─── API Error ───────────────────────────────────────────────

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}
