import Echo from 'laravel-echo';
import type { BroadcastDriver } from 'laravel-echo';
import Pusher from 'pusher-js';
import axios from 'axios';

type EchoInstance = Echo<BroadcastDriver>;

let echoInstance: EchoInstance | null = null;

export function getEcho(): EchoInstance {
  if (echoInstance) return echoInstance;

  if (typeof window === 'undefined') {
    throw new Error('Echo ne peut être initialisé que côté client');
  }

  // Pusher doit être accessible globalement pour laravel-echo
  (window as unknown as Record<string, unknown>).Pusher = Pusher;

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

  echoInstance = new Echo({
    broadcaster: 'reverb',
    key: process.env.NEXT_PUBLIC_REVERB_APP_KEY || '',
    wsHost: process.env.NEXT_PUBLIC_REVERB_HOST || 'localhost',
    wsPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT) || 8080,
    wssPort: Number(process.env.NEXT_PUBLIC_REVERB_PORT) || 8080,
    forceTLS: process.env.NEXT_PUBLIC_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel: { name: string }) => ({
      authorize: (socketId: string, callback: (error: Error | null, data: { auth: string; channel_data?: string } | null) => void) => {
        const playerToken = typeof window !== 'undefined' ? localStorage.getItem('player_token') : null;
        const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null;

        // Déterminer l'endpoint et les headers selon le type de canal
        const isPlayerChannel = channel.name.startsWith('private-player.');
        const authUrl = isPlayerChannel
          ? `${backendUrl}/player/broadcasting/auth`
          : `${backendUrl.replace(/\/api$/, '')}/broadcasting/auth`;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (isPlayerChannel && playerToken) {
          headers['X-Player-Token'] = playerToken;
        } else if (adminToken) {
          headers['Authorization'] = `Bearer ${adminToken}`;
        }

        axios.post(authUrl, {
          socket_id: socketId,
          channel_name: channel.name,
        }, { headers })
          .then((response) => callback(null, response.data))
          .catch((error) => callback(error, null));
      },
    }),
  });

  return echoInstance;
}

export function disconnectEcho(): void {
  if (echoInstance) {
    echoInstance.disconnect();
    echoInstance = null;
  }
}
