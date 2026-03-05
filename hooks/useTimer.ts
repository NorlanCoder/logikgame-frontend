'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/stores/gameStore';

/**
 * Hook pour gérer le timer local synchronisé avec le serveur.
 * Le serveur envoie timer.tick pour corriger le décompte.
 */
export function useTimer() {
  const timerSeconds = useGameStore((s) => s.timerSeconds);
  const setTimer = useGameStore((s) => s.setTimer);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(
    (duration: number) => {
      setTimer(duration);

      if (intervalRef.current) clearInterval(intervalRef.current);

      intervalRef.current = setInterval(() => {
        useGameStore.setState((state) => {
          const next = state.timerSeconds - 1;
          if (next <= 0) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            return { timerSeconds: 0 };
          }
          return { timerSeconds: next };
        });
      }, 1000);
    },
    [setTimer]
  );

  const stopCountdown = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const syncTimer = useCallback(
    (remaining: number) => {
      setTimer(remaining);
    },
    [setTimer]
  );

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return { timerSeconds, startCountdown, stopCountdown, syncTimer };
}
