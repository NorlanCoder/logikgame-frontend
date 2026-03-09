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
        useGameStore.getState().setResult(e.is_correct, e.correct_answer);
        if (!e.is_correct) {
          // Le joueur pourrait être éliminé — le status arrive via player.eliminated
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
