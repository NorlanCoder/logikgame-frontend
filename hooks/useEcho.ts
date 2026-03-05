'use client';

import { useEffect, useRef } from 'react';
import { getEcho, disconnectEcho } from '@/lib/echo';
import type Echo from 'laravel-echo';
import type { BroadcastDriver } from 'laravel-echo';

type EchoInstance = Echo<BroadcastDriver>;

/**
 * Hook pour accéder à l'instance Laravel Echo.
 * Gère la connexion/déconnexion automatiquement.
 */
export function useEcho(): EchoInstance | null {
  const echoRef = useRef<EchoInstance | null>(null);

  useEffect(() => {
    try {
      echoRef.current = getEcho();
    } catch {
      // côté serveur – ignorer
    }

    return () => {
      // Ne pas déconnecter au unmount individuel
      // La déconnexion se fait via disconnectEcho() explicitement
    };
  }, []);

  return echoRef.current;
}

export { disconnectEcho };
