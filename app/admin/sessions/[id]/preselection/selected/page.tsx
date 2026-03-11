'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import type { RegistrationStatus } from '@/lib/types';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChevronRight, Star } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────

interface PreselectionRegistration {
  registration_id: number;
  status: RegistrationStatus;
  registered_at: string;
  player: {
    id: number;
    full_name: string;
    pseudo: string;
    email: string;
    phone: string;
  } | null;
  preselection_result: {
    correct_answers_count: number;
    total_questions: number;
    score_percent: number;
    total_response_time_ms: number;
    completed_at: string;
  } | null;
}

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${s}s`;
}

// ─── Page ─────────────────────────────────────────────────────

export default function SelectedPlayersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [registrations, setRegistrations] = useState<PreselectionRegistration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await api.get(
          `/admin/sessions/${id}/preselection/registrations?status=selected`
        );
        setRegistrations(res.data.data ?? []);
      } catch {
        toast.error('Erreur lors du chargement des joueurs sélectionnés.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [id]);

  return (
    <div className="space-y-6 p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/admin/sessions" className="hover:text-foreground">
          Sessions
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/admin/sessions/${id}`} className="hover:text-foreground">
          Session #{id}
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Joueurs sélectionnés</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
          <Star className="h-5 w-5 text-emerald-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Joueurs sélectionnés</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? '…' : `${registrations.length} joueur(s) retenu(s) pour la session`}
          </p>
        </div>
      </div>

      {/* Tableau */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Classement</CardTitle>
          <CardDescription>
            Trié par score décroissant, puis par temps de réponse croissant.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded" />
              ))}
            </div>
          ) : registrations.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Aucun joueur sélectionné pour le moment.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Temps total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg, idx) => (
                  <TableRow key={reg.registration_id}>
                    <TableCell className="font-mono text-muted-foreground">
                      {idx + 1}
                    </TableCell>
                    <TableCell>
                      {reg.player ? (
                        <>
                          <p className="font-semibold">{reg.player.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            @{reg.player.pseudo}
                          </p>
                        </>
                      ) : (
                        <span className="text-sm italic text-muted-foreground">
                          Inscription #{reg.registration_id}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {reg.player?.email ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {reg.preselection_result ? (
                        <span className="font-semibold">
                          {reg.preselection_result.correct_answers_count}/
                          {reg.preselection_result.total_questions}
                          <span className="ml-1 text-xs text-muted-foreground">
                            ({reg.preselection_result.score_percent.toFixed(0)}%)
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {reg.preselection_result
                        ? fmtTime(reg.preselection_result.total_response_time_ms)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/admin/sessions/${id}/preselection/registrations/${reg.registration_id}`
                          )
                        }
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
