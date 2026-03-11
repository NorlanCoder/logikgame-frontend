'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Button, Input, Label } from '@/components/ui';
import { Loader2, LogIn, XCircle } from 'lucide-react';

// ─── Formulaire ───────────────────────────────────────────────

function JoinForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-join si le token est présent dans l'URL
  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      submitJoin(urlToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitJoin(tokenValue: string) {
    setLoading(true);
    setError(null);
    // Écraser l'ancien token avant l'appel pour que l'intercepteur Axios utilise le nouveau
    localStorage.setItem('player_token', tokenValue);
    try {
      await api.post('/player/join', {});
      router.push('/player/game');
    } catch (err: unknown) {
      const msg = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data?.message;
      setError(
        msg ??
          'Token invalide ou session non disponible. Vérifiez votre e-mail.'
      );
      localStorage.removeItem('player_token');
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submitJoin(token.trim());
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400">
            <LogIn className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-bold">Rejoindre la partie</h1>
          <p className="mt-2 text-gray-400">
            Entrez le code d&apos;accès reçu par e-mail pour accéder à la salle
            de jeu.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="token">Votre code d&apos;accès</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Collez votre token ici…"
              className="font-mono text-sm"
              required
              autoFocus={!searchParams.get('token')}
            />
            <p className="text-xs text-gray-500">
              Ce code vous a été envoyé par e-mail lors de votre sélection.
            </p>
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading || !token.trim()} className="mt-5 w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connexion en cours…
              </>
            ) : (
              'Accéder à la salle de jeu'
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Pas encore inscrit ?{' '}
          <Link href="/" className="text-blue-400 hover:underline">
            Voir les sessions disponibles
          </Link>
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function JoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }
      >
        <JoinForm />
      </Suspense>
    </div>
  );
}
