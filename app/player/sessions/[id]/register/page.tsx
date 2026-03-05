'use client';

import { use, useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button, Input, Label } from '@/components/ui';
import api from '@/lib/api';
import type { Session, ApiError } from '@/lib/types';
import {
  Loader2,
  Calendar,
  Users,
  Trophy,
  ArrowLeft,
  ImageOff,
} from 'lucide-react';

export default function SessionRegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    pseudo: '',
  });

  useEffect(() => {
    api
      .get(`/player/sessions/${id}`)
      .then((res) => setSession(res.data.data ?? res.data))
      .catch(() => setSessionError('Session introuvable.'))
      .finally(() => setSessionLoading(false));
  }, [id]);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    setGeneralError(null);

    try {
      await api.post('/player/register', {
        ...form,
        session_id: Number(id),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const resp = (err as { response?: { data?: ApiError & { message?: string } } }).response
        ?.data;
      if (resp?.errors) {
        setErrors(resp.errors);
      } else if (resp?.message) {
        setGeneralError(resp.message);
      }
    } finally {
      setLoading(false);
    }
  }

  // — Loading session
  if (sessionLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  // — Session not found
  if (sessionError || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <ImageOff className="h-16 w-16 text-gray-600" />
        <h2 className="text-2xl font-bold">{sessionError ?? 'Session introuvable'}</h2>
        <Link href="/" className="text-blue-400 underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  // — Registration success
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="text-2xl font-bold">Inscription réussie !</h2>
          <p className="mt-2 text-gray-400">
            Vous êtes inscrit à <span className="font-semibold text-white">{session.name}</span>.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Vérifiez votre e-mail pour la confirmation et les prochaines étapes.
          </p>
          <Link
            href="/"
            className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold transition-colors hover:bg-blue-700"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8 md:px-8">
      {/* Back link */}
      <div className="w-full max-w-2xl">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1 text-sm text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour aux sessions
        </Link>
      </div>

      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60">
        {/* Session cover + info */}
        <div className="relative h-48 w-full bg-gray-800">
          {session.cover_image_url ? (
            <Image
              src={session.cover_image_url}
              alt={session.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl font-bold text-gray-700">
              LG
            </div>
          )}
        </div>

        <div className="space-y-4 p-6">
          <h1 className="text-2xl font-bold">{session.name}</h1>
          {session.description && (
            <p className="text-gray-400">{session.description}</p>
          )}

          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {new Date(session.scheduled_at).toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {session.max_players} joueurs max
            </span>
            <span className="flex items-center gap-1">
              <Trophy className="h-4 w-4" />
              {(session.jackpot ?? 0).toLocaleString('fr-FR')} pts
            </span>
          </div>
        </div>

        {/* Registration form */}
        <div className="border-t border-gray-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Inscription</h2>

          {generalError && (
            <div className="mb-4 rounded-lg border border-red-800 bg-red-900/30 px-4 py-3 text-sm text-red-400">
              {generalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="full_name">Nom complet</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e) => updateField('full_name', e.target.value)}
                  placeholder="Jean Dupont"
                  required
                />
                {errors.full_name?.[0] && (
                  <p className="text-sm text-red-400">{errors.full_name[0]}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="pseudo">Pseudo (nom de jeu)</Label>
                <Input
                  id="pseudo"
                  value={form.pseudo}
                  onChange={(e) => updateField('pseudo', e.target.value)}
                  placeholder="MonPseudo123"
                  required
                />
                {errors.pseudo?.[0] && (
                  <p className="text-sm text-red-400">{errors.pseudo[0]}</p>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder="jean@example.com"
                  required
                />
                {errors.email?.[0] && (
                  <p className="text-sm text-red-400">{errors.email[0]}</p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  placeholder="+22891234567"
                  required
                />
                {errors.phone?.[0] && (
                  <p className="text-sm text-red-400">{errors.phone[0]}</p>
                )}
              </div>
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              S&apos;inscrire à cette session
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
