'use client';

import { useEffect, useRef } from 'react';
import { useEcho } from '@/hooks/useEcho';
import { useGameStore } from '@/stores/gameStore';
import type {
  WsQuestionLaunched,
  WsQuestionClosed,
  WsAnswerRevealed,
  WsPlayerEliminated,
  WsJackpotUpdated,
  WsRoundStarted,
  WsRoundEnded,
  WsTimerTick,
  WsGameEnded,
  WsSecondChanceLaunched,
  WsSecondChanceRevealed,
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

        // En manche 3, si le joueur a déjà reçu son résultat (phase 'result'),
        // et qu'il y a des joueurs en danger, transitionner vers danger/safe
        if (
          state.currentRound?.round_type === 'second_chance' &&
          inDangerCount > 0 &&
          state.phase === 'result' &&
          state.isCorrect !== null
        ) {
          useGameStore.setState({
            phase: state.isCorrect === false ? 'second_chance_danger' : 'second_chance_safe',
          });
        }
      })
      .listen('.answer.revealed', (e: WsAnswerRevealed) => {
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;
        // Toujours marquer le reveal (même sans choices pour les questions texte/nombre)
        state.setRevealedChoices(e.choices ?? []);
        useGameStore.setState({ correctAnswer: e.correct_answer });

        // Si le joueur a répondu mais n'a pas encore reçu son résultat (AnswerResult),
        // déduire isCorrect depuis les données du reveal
        if ((state.phase === 'answered' || state.phase === 'result') && state.hasAnswered) {
          let isCorrect = state.isCorrect;

          // Calculer isCorrect si pas encore déterminé
          if (isCorrect === null) {
            const choices = e.choices ?? [];
            if (state.selectedChoiceId && choices.length > 0) {
              // QCM : vérifier si le choix sélectionné est correct
              const selectedChoice = choices.find((c: { id: number; is_correct: boolean }) => c.id === state.selectedChoiceId);
              isCorrect = selectedChoice?.is_correct ?? false;
            } else if (state.currentQuestion?.answer_type === 'qcm') {
              // QCM mais pas de choix sélectionné (timeout localement)
              isCorrect = false;
            } else if (e.correct_answer && state.answerValue) {
              // Texte/Nombre : comparer avec la bonne réponse
              const normalize = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              isCorrect = normalize(state.answerValue) === normalize(e.correct_answer);
            } else {
              isCorrect = false;
            }
            useGameStore.setState({ isCorrect });
          }

          // Transition de phase
          if (
            state.currentRound?.round_type === 'second_chance' &&
            state.inDangerCount > 0
          ) {
            useGameStore.setState({
              phase: isCorrect === false ? 'second_chance_danger' : 'second_chance_safe',
            });
          } else {
            useGameStore.setState({ phase: 'result' });
          }
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

        // Si le joueur a répondu à la SC mais n'a pas reçu son résultat,
        // déduire scIsCorrect depuis les données du reveal
        if (state.phase === 'sc_answered' && state.hasAnswered) {
          let scIsCorrect = state.scIsCorrect;

          if (scIsCorrect === null) {
            const choices = e.choices ?? [];
            if (state.selectedChoiceId && choices.length > 0) {
              const selected = choices.find((c: { id: number; is_correct: boolean }) => c.id === state.selectedChoiceId);
              scIsCorrect = selected?.is_correct ?? false;
            } else if (state.secondChanceQuestion?.answer_type === 'qcm') {
              scIsCorrect = false;
            } else if (e.correct_answer && state.answerValue) {
              const normalize = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
              scIsCorrect = normalize(state.answerValue) === normalize(e.correct_answer);
            } else {
              scIsCorrect = false;
            }
          }

          useGameStore.setState({
            scIsCorrect,
            scCorrectAnswer: e.correct_answer,
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
