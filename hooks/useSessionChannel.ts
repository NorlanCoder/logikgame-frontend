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
        state.setQuestion(e.question);
        startCountdown(e.question.duration);
      })
      .listen('.question.closed', (e: WsQuestionClosed) => {
        const state = useGameStore.getState();
        if (state.phase === 'round_skipped') return;
        stopCountdown();
        useGameStore.setState({ inDangerCount: e.in_danger_count ?? 0 });
      })
      .listen('.answer.revealed', (e: WsAnswerRevealed) => {
        const state = useGameStore.getState();
        if (state.phase === 'eliminated' || state.phase === 'game_ended' || state.phase === 'round_skipped') return;
        // Toujours marquer le reveal (même sans choices pour les questions texte/nombre)
        state.setRevealedChoices(e.choices ?? []);
        if (state.correctAnswer === null) {
          useGameStore.setState({ correctAnswer: e.correct_answer });
        }
        // En manche 3 (seconde chance), afficher l'état danger/safe dès le reveal
        // Fonctionne que le joueur soit en phase 'result' ou 'answered'
        // NB: si isCorrect est null (AnswerResult pas encore reçu), on ne transitionne pas
        // → c'est setResult qui gérera la transition quand il arrivera
        if (
          state.currentRound?.round_type === 'second_chance' &&
          state.inDangerCount > 0 &&
          (state.phase === 'result' || state.phase === 'answered') &&
          state.isCorrect !== null
        ) {
          useGameStore.setState({
            phase: state.isCorrect === false ? 'second_chance_danger' : 'second_chance_safe',
          });
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
      });

    return () => {
      echo.leaveChannel(channelName);
      subscribedRef.current = null;
    };
  }, [echo, sessionId, startCountdown, stopCountdown, syncTimer]);
}
