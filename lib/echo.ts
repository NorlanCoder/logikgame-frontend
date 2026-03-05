import Echo from 'laravel-echo';
import type { BroadcastDriver } from 'laravel-echo';
import Pusher from 'pusher-js';

type EchoInstance = Echo<BroadcastDriver>;

let echoInstance: EchoInstance | null = null;

export function getEcho(): EchoInstance {
  if (echoInstance) return echoInstance;

  if (typeof window === 'undefined') {
    throw new Error('Echo ne peut être initialisé que côté client');
  }

  // Pusher doit être accessible globalement pour laravel-echo
  (window as unknown as Record<string, unknown>).Pusher = Pusher;

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY || '',
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost',
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT) || 8080,
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT) || 8080,
    forceTLS: process.env.NEXT_PUBLIC_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
  });

  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
}
