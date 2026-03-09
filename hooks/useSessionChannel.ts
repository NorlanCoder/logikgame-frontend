'use client';

import { useEffect, useRef } from 'react';
import { useEcho } from '@/hooks/useEcho';
import { useGameStore } from '@/stores/gameStore';
import type {
  WsQuestionLaunched,
  WsAnswerRevealed,
  WsPlayerEliminated,
  WsJackpotUpdated,
  WsRoundStarted,
  WsRoundEnded,
  WsTimerTick,
  WsGameEnded,
  WsSecondChanceLaunched,
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
        useGameStore.getState().setQuestion(e.question);
        startCountdown(e.question.duration);
      })
      .listen('.question.closed', () => {
        stopCountdown();
      })
      .listen('.answer.revealed', (e: WsAnswerRevealed) => {
        const state = useGameStore.getState();
        if (e.choices) {
          state.setRevealedChoices(e.choices);
        }
        // Si le joueur n'a pas encore reçu son résultat perso, on met le correctAnswer
        if (state.correctAnswer === null) {
          useGameStore.setState({ correctAnswer: e.correct_answer });
        }
      })
      .listen('.player.eliminated', (e: WsPlayerEliminated) => {
        useGameStore.getState().setEliminated(e.eliminated);
        useGameStore.getState().updateJackpot(e.jackpot, e.players_remaining);
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
      });

    return () => {
      echo.leaveChannel(channelName);
      subscribedRef.current = null;
    };
  }, [echo, sessionId, startCountdown, stopCountdown, syncTimer]);
}
