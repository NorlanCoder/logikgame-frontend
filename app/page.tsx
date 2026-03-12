'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import api from '@/lib/api';
import type { Session, SessionStatus } from '@/lib/types';
import { SESSION_STATUS_LABELS } from '@/lib/constants';
import { Calendar, Users, Loader2, Radio, Trophy, Clock } from 'lucide-react';

function getStatusCta(session: Session) {
  const s = session.status;

  if (s === 'registration_open' || s === 'preselection') {
    return {
      label: s === 'registration_open' ? "S'inscrire →" : 'Pré-sélection — S\'inscrire →',
      href: `/player/sessions/${session.id}/register`,
      className: s === 'registration_open' ? 'bg-blue-600/20 text-blue-400' : 'bg-yellow-600/20 text-yellow-400',
    };
  }
  if (s === 'ready' || s === 'in_progress') {
    const projUrl = session.projection_code
      ? `/projection/${session.projection_code}`
      : `/projection/auth`;
    return {
      label: s === 'ready' ? 'Voir la présentation →' : 'Suivre en direct →',
      href: projUrl,
      className: s === 'ready' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-red-600/20 text-red-400',
    };
  }
  if (s === 'ended') {
    return {
      label: 'Terminée',
      href: null,
      className: 'bg-gray-600/20 text-gray-400',
    };
  }
  // registration_closed, paused, cancelled, draft, etc.
  return {
    label: SESSION_STATUS_LABELS[s] ?? s,
    href: null,
    className: 'bg-gray-600/20 text-gray-400',
  };
}

const statusBorderColors: Partial<Record<SessionStatus, string>> = {
  in_progress: 'border-red-500/50 shadow-red-500/10',
  ready: 'border-emerald-500/50 shadow-emerald-500/10',
};

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
          {/* <Link
            href="/diag/realtime"
            className="rounded-lg border border-cyan-600/60 px-4 py-2 text-sm font-medium text-cyan-300 transition-colors hover:bg-cyan-900/40"
          >
            Test Prod Temps Reel
          </Link> */}
          {/* <Link
            href="/admin/login"
            className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-800"
          >
            Administration
          </Link> */}
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
            {sessions.map((session) => {
              const cta = getStatusCta(session);
              const borderExtra = statusBorderColors[session.status] ?? '';
              const baseClass = `group flex flex-col overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 transition-all ${borderExtra}`;

              const inner = (
                <>
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
                    {/* Status badge */}
                    <div className="absolute top-2 right-2">
                      {session.status === 'in_progress' && (
                        <span className="flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-1 text-xs font-semibold text-white">
                          <Radio className="h-3 w-3" /> En direct
                        </span>
                      )}
                      {session.status === 'ready' && (
                        <span className="flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                          <Clock className="h-3 w-3" /> Imminent
                        </span>
                      )}
                      {session.status === 'preselection' && (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-600 px-2.5 py-1 text-xs font-semibold text-white">
                          Pré-sélection
                        </span>
                      )}
                    </div>
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

                    {/* Live stats */}
                    {session.status === 'in_progress' && (
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-red-400">
                          <Users className="h-4 w-4" />
                          {session.players_remaining ?? 0} en jeu
                        </span>
                        <span className="flex items-center gap-1 text-yellow-400">
                          <Trophy className="h-4 w-4" />
                          {(session.jackpot ?? 0).toLocaleString('fr-FR')} XAF
                        </span>
                      </div>
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

                    <div className={`mt-2 rounded-lg px-3 py-2 text-center text-sm font-semibold ${cta.className}`}>
                      {cta.label}
                    </div>
                  </div>
                </>
              );

              return cta.href ? (
                <Link
                  key={session.id}
                  href={cta.href}
                  className={`${baseClass} hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10`}
                >
                  {inner}
                </Link>
              ) : (
                <div key={session.id} className={baseClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
