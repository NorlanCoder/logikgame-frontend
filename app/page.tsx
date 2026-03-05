'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import type { Session } from '@/lib/types';
import { Calendar, Users, Loader2 } from 'lucide-react';

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/player/sessions')
      .then((res) => setSessions(res.data.data ?? res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-blue-950 via-gray-900 to-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
          LOGIK <span className="text-blue-400">GAME</span>
        </h1>
        <div className="flex gap-3">
          <Link
            href="/admin/login"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-800"
          >
            Administration
          </Link>
          <Link
            href="/projection/auth"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-800"
          >
            Projection
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="flex flex-col items-center gap-4 px-6 pt-12 pb-8 text-center">
        <h2 className="text-4xl font-extrabold tracking-tight md:text-6xl">
          Testez votre <span className="text-blue-400">logique</span>
        </h2>
        <p className="max-w-lg text-lg text-gray-400">
          Rejoignez une session, répondez aux questions et tentez de remporter la cagnotte !
        </p>
      </section>

      {/* Sessions disponibles */}
      <section className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
        <h3 className="mb-6 text-xl font-bold">Sessions disponibles</h3>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-12 text-center">
            <p className="text-lg text-gray-500">Aucune session disponible pour le moment.</p>
            <p className="mt-2 text-sm text-gray-600">
              Revenez plus tard pour participer à une session LOGIK GAME.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/player/sessions/${session.id}/register`}
                className="group flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 transition-all hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10"
              >
                {/* Cover */}
                <div className="relative h-40 w-full bg-gray-800">
                  {session.cover_image_url ? (
                    <Image
                      src={session.cover_image_url}
                      alt={session.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-4xl font-bold text-gray-700">
                      LG
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <h4 className="text-lg font-bold group-hover:text-blue-400 transition-colors">
                    {session.name}
                  </h4>
                  {session.description && (
                    <p className="line-clamp-2 text-sm text-gray-400">
                      {session.description}
                    </p>
                  )}

                  <div className="mt-auto flex items-center gap-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {new Date(session.scheduled_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {session.max_players} joueurs max
                    </span>
                  </div>

                  <div className="mt-2 rounded-lg bg-blue-600/20 px-3 py-2 text-center text-sm font-semibold text-blue-400">
                    S&apos;inscrire →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
