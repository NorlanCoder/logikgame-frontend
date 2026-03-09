'use client';

import { useEffect, useState } from 'react';
import { getEcho, disconnectEcho } from '@/lib/echo';
import type Echo from 'laravel-echo';
import type { BroadcastDriver } from 'laravel-echo';

type EchoInstance = Echo<BroadcastDriver>;

/**
 * Hook pour accéder à l'instance Laravel Echo.
 * Gère la connexion/déconnexion automatiquement.
 */
export function useEcho(): EchoInstance | null {
  const [echo, setEcho] = useState<EchoInstance | null>(null);

  useEffect(() => {
    try {
      setEcho(getEcho());
    } catch {
      // côté serveur – ignorer
    }
  }, []);

  return echo;
}

export { disconnectEcho };
