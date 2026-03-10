'use client';

import { useEffect, useRef } from 'react';
import { useEcho } from '@/hooks/useEcho';
import { useGameStore } from '@/stores/gameStore';
import type { WsAnswerResult, WsHintApplied } from '@/lib/types';

/**
 * Écoute le canal privé `player.{sessionPlayerId}` pour les events personnels.
 */
export function usePlayerChannel(sessionPlayerId: number | null) {
  const echo = useEcho();
  const subscribedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!echo || !sessionPlayerId || subscribedRef.current === sessionPlayerId)
      return;

    const channelName = `player.${sessionPlayerId}`;
    subscribedRef.current = sessionPlayerId;

    const channel = echo.private(channelName);

    channel
      .listen('.answer.result', (e: WsAnswerResult) => {
        const state = useGameStore.getState();
        if (state.phase === 'round_skipped') return;
        const scPhases = ['second_chance', 'sc_answered', 'second_chance_danger'];
        if (scPhases.includes(state.phase)) {
          state.setScResult(e.is_correct, e.correct_answer);
        } else {
          state.setResult(e.is_correct, e.correct_answer);
        }
      })
      .listen('.hint.applied', (e: WsHintApplied) => {
        useGameStore.getState().applyHint(e.hint);
      });

    return () => {
      echo.leaveChannel(channelName);
      subscribedRef.current = null;
    };
  }, [echo, sessionPlayerId]);
}
