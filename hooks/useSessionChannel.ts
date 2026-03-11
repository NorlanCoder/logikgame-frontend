'use client';

import { useEffect, useRef } from 'react';
import { useEcho } from '@/hooks/useEcho';
import { useGameStore } from '@/stores/gameStore';
import type {
  WsQuestionLaunched,
  WsQuestionClosed,
  WsAnswerRevealed,
  WsResultsRevealed,
  WsPlayerEliminated,
  WsJackpotUpdated,
  WsRoundStarted,
  WsRoundEnded,
  WsTimerTick,
  WsGameEnded,
  WsSecondChanceLaunched,
  WsSecondChanceRevealed,
  WsScResultsRevealed,
  WsFinaleChoicesRevealed,
  WsFinaleVoteLaunched,
  WsDuelQuestionsAssigned,
} from '@/lib/types';
import { useTimer } from '@/hooks/useTimer';

/**
 * Écoute le canal public `session.{sessionId}` pour tous les events de jeu.
 */
export function useSessionChannel(sessionId: number | null) {
  const echo = useEcho();
  const { startCountdown, stopCountdown, syncTimer } = useTimer();
  const subscribedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!echo || !sessionId || subscribedRef.current === sessionId) return;

    const channelName = `session.${sessionId}`;
    subscribedRef.current = sessionId;

    const channel = echo.channel(channelName);

    channel
      .listen('.round.started', (e: WsRoundStarted) => {
        useGameStore.getState().setRound({
          round_number: e.round_number,
          name: e.name,
          round_type: e.round_type,
          rules_description: e.rules_description,
        });
      })
      .listen('.question.launched', (e: WsQuestionLaunched) => {
        const state = useGameStore.getState();
        if (state.phase === 'round_skipped') return;
        // En finale, les joueurs ayant abandonné ne reçoivent pas la question
        if (state.finaleAbandoned) return;
        state.setQuestion(e.question);
        // En duel, seul le joueur assigné lance le countdown
        const isDuel = state.currentRound?.round_type === 'duel_jackpot' || state.currentRound?.round_type === 'duel_elimination';
        const isMyTurn = e.question.assigned_player_id === state.sessionPlayerId;
        if (!isDuel || isMyTurn) {
          startCountdown(e.question.duration);
        }
      })
      .listen('.duel.questions.assigned', (e: WsDuelQuestionsAssigned) => {
        useGameStore.getState().setDuelAssignments(e.assignments);
      })
      .listen('.question.closed', (e: WsQuestionClosed) => {
        const state = useGameStore.getState();
        if (state.phase === 'round_skipped') return;
        stopCountdown();
        const inDangerCount = e.in_danger_count ?? 0;
        useGameStore.setState({ inDangerCount });
        // Plus de transition de phase ici — elle se fait lors du reveal
      })
      .listen('.answer.revealed', (e: WsAnswerRevealed) => {
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;
        state.setRevealedChoices(e.choices ?? []);
        useGameStore.setState({ correctAnswer: e.correct_answer, phase: 'answer_revealed' });
      })
      .listen('.results.revealed', (e: WsResultsRevealed) => {
        void e;
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;

        // Déterminer isCorrect : utiliser la valeur du store si déjà reçue via AnswerResult,
        // sinon déduire depuis les données du reveal
        let isCorrect = useGameStore.getState().isCorrect;

        if (isCorrect === null && state.hasAnswered) {
          const choices = useGameStore.getState().revealedChoices ?? [];
          if (state.selectedChoiceId && choices.length > 0) {
            const selectedChoice = choices.find((c: { id: number; is_correct: boolean }) => c.id === state.selectedChoiceId);
            isCorrect = selectedChoice?.is_correct ?? false;
          } else if (state.currentQuestion?.answer_type === 'qcm') {
            isCorrect = false;
          } else if (state.correctAnswer && state.answerValue) {
            const normalize = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            isCorrect = normalize(state.answerValue) === normalize(state.correctAnswer);
          } else {
            isCorrect = false;
          }
        }

        if (isCorrect === null) isCorrect = false;

        if (
          state.currentRound?.round_type === 'second_chance' &&
          useGameStore.getState().inDangerCount > 0
        ) {
          useGameStore.setState({
            isCorrect,
            phase: isCorrect === false ? 'second_chance_danger' : 'second_chance_safe',
          });
        } else {
          useGameStore.setState({ isCorrect, phase: 'result' });
        }
      })
      .listen('.player.eliminated', (e: WsPlayerEliminated) => {
        const state = useGameStore.getState();
        state.setEliminated(e.eliminated);
        state.updateJackpot(e.jackpot, e.players_remaining);
        // Si le joueur courant est dans les éliminés, mettre à jour sa phase
        if (state.sessionPlayerId && e.eliminated_player_ids?.includes(state.sessionPlayerId)) {
          state.setPlayerStatus('eliminated');
        }
      })
      .listen('.jackpot.updated', (e: WsJackpotUpdated) => {
        useGameStore.getState().updateJackpot(e.jackpot, e.players_remaining);
      })
      .listen('.round.ended', (e: WsRoundEnded) => {
        useGameStore.getState().updateJackpot(e.jackpot, e.players_remaining);
        useGameStore.getState().resetQuestion();
      })
      .listen('.timer.tick', (e: WsTimerTick) => {
        syncTimer(e.remaining_seconds);
      })
      .listen('.timer.expired', () => {
        stopCountdown();
        useGameStore.getState().setTimer(0);
      })
      .listen('.game.ended', (e: WsGameEnded) => {
        stopCountdown();
        useGameStore.getState().setGameEnded(e.final_jackpot, e.winners);
      })
      .listen('.finale.vote.launched', (e: WsFinaleVoteLaunched) => {
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;
        useGameStore.setState({ phase: 'finale_choice', finaleFinalists: e.finalists });
      })
      .listen('.finale.choices.revealed', (e: WsFinaleChoicesRevealed) => {
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
        const myChoice = e.choices.find((c) => c.session_player_id === state.sessionPlayerId);
        const abandoned = myChoice?.choice === 'abandon';
        useGameStore.setState({ finaleChoices: e.choices, finaleScenario: e.scenario, finaleAbandoned: abandoned, phase: 'finale_result' });
      })
      .listen('.second_chance.launched', (e: WsSecondChanceLaunched) => {
        useGameStore.getState().setSecondChanceQuestion(
          e.question,
          e.failed_player_ids,
          e.main_question_id,
        );
        // Lancer le compte à rebours uniquement pour les joueurs en seconde chance
        if (useGameStore.getState().phase === 'second_chance') {
          startCountdown(e.question.duration);
        }
      })
      .listen('.second_chance.revealed', (e: WsSecondChanceRevealed) => {
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended') return;
        state.setScRevealedChoices(e.choices ?? [], e.correct_answer);
        // Les SC participants voient la réponse mais pas encore le résultat
        const scParticipantPhases = ['second_chance', 'sc_answered', 'second_chance_danger'];
        if (scParticipantPhases.includes(state.phase)) {
          useGameStore.setState({ phase: 'sc_answer_revealed' });
        }
      })
      .listen('.sc_results.revealed', (e: WsScResultsRevealed) => {
        void e;
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended') return;

        const scParticipantPhases = ['second_chance', 'sc_answered', 'second_chance_danger', 'sc_answer_revealed'];
        if (scParticipantPhases.includes(state.phase)) {
          let scIsCorrect = useGameStore.getState().scIsCorrect;

          if (scIsCorrect === null && state.hasAnswered) {
            const choices = useGameStore.getState().scRevealedChoices ?? [];
            if (state.selectedChoiceId && choices.length > 0) {
              const selected = choices.find((c: { id: number; is_correct: boolean }) => c.id === state.selectedChoiceId);
              scIsCorrect = selected?.is_correct ?? false;
            } else if (state.secondChanceQuestion?.answer_type === 'qcm') {
              scIsCorrect = false;
            } else if (useGameStore.getState().scCorrectAnswer && state.answerValue) {
              const normalize = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              scIsCorrect = normalize(state.answerValue) === normalize(useGameStore.getState().scCorrectAnswer!);
            } else {
              scIsCorrect = false;
            }
          }

          if (scIsCorrect === null) scIsCorrect = false;

          useGameStore.setState({
            scIsCorrect,
            phase: 'sc_result',
          });
        }
      });

    return () => {
      echo.leaveChannel(channelName);
      subscribedRef.current = null;
    };
  }, [echo, sessionId, startCountdown, stopCountdown, syncTimer]);
}
