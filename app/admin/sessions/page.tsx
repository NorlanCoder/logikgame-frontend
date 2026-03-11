'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSessionStore } from '@/stores/sessionStore';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  StatusBadge,
} from '@/components/ui';
import api from '@/lib/api';
import type { Session } from '@/lib/types';
import Image from 'next/image';
import { Plus, Calendar, Users, Trophy, ClipboardList, ImageOff } from 'lucide-react';

export default function AdminSessionsPage() {
  const { sessions, setSessions } = useSessionStore();

  useEffect(() => {
    async function fetchSessions() {
      try {
        const res = await api.get<{ data: Session[] }>('/admin/sessions');
        setSessions(res.data.data ?? (res.data as unknown as Session[]));
      } catch {
        // Erreur geree par l'intercepteur
      }
    }
    fetchSessions();
  }, [setSessions]);

  return (
    <div className="animate-fade-in">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
        <Link href="/admin/sessions/create">
          <Button>
            <Plus className="h-4 w-4" />
            Nouvelle session
          </Button>
        </Link>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">
              Aucune session creee. Commencez par en creer une !
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <Link key={session.id} href={`/admin/sessions/${session.id}`}>
              <Card className="overflow-hidden pt-0 transition-shadow hover:shadow-md">
                {session.cover_image_url ? (
                  <div className="relative h-36 w-full">
                    <Image
                      src={session.cover_image_url}
                      alt={session.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 400px"
                    />
                  </div>
                ) : (
                  <div className="flex h-36 w-full items-center justify-center bg-muted">
                    <ImageOff className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                )}
                <CardHeader className="pb-3 pt-4">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-base">
                      {session.name}
                    </CardTitle>
                    <StatusBadge status={session.status} />
                  </div>
                  {session.description && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {session.description}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 shrink-0" />
                    <span>
                      {new Date(session.scheduled_at).toLocaleDateString(
                        'fr-FR',
                        { dateStyle: 'long' }
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 shrink-0" />
                    <span>{session.max_players} joueurs max</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4 shrink-0" />
                      <span>
                        {session.jackpot.toLocaleString('fr-FR')} pts
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs">
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span>{session.registrations_count} inscrits</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
