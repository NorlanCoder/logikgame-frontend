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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Check,
  ChevronRight,
  Loader2,
  RefreshCw,
  UserCheck,
} from 'lucide-react';

// ─── Types locaux ────────────────────────────────────────────

interface PreselectionStats {
  total_registered: number;
  total_done: number;
  total_pending: number;
  total_not_started: number;
  total_selected: number;
  total_rejected: number;
}

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

const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  registered: 'Inscrit',
  preselection_pending: 'En attente',
  preselection_done: 'Quiz terminé',
  selected: 'Sélectionné',
  rejected: 'Refusé',
};

const REGISTRATION_STATUS_COLORS: Record<RegistrationStatus, string> = {
  registered: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  preselection_pending: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  preselection_done: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  selected: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

function RegStatusBadge({ status }: { status: RegistrationStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      REGISTRATION_STATUS_COLORS[status]
    }`}>
      {REGISTRATION_STATUS_LABELS[status]}
    </span>
  );
}

const STATUS_FILTER_LABELS: Record<string, string> = {
  all: 'Tous',
  registered: 'Inscrits',
  preselection_pending: 'En attente du quiz',
  preselection_done: 'Quiz terminé',
  selected: 'Sélectionnés',
  rejected: 'Refusés',
};

function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${s}s`;
}

// ─── Page ─────────────────────────────────────────────────────

export default function PreselectionRegistrationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [stats, setStats] = useState<PreselectionStats | null>(null);
  const [registrations, setRegistrations] = useState<PreselectionRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Sélection manuelle
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectDialogOpen, setSelectDialogOpen] = useState(false);
  const [selectLoading, setSelectLoading] = useState(false);

  async function fetchData(filter?: string) {
    const params = filter && filter !== 'all' ? `?status=${filter}` : '';
    try {
      const res = await api.get(
        `/admin/sessions/${id}/preselection/registrations${params}`
      );
      setStats(res.data.stats);
      setRegistrations(res.data.data ?? []);
    } catch {
      toast.error('Erreur lors du chargement des inscriptions.');
    }
  }

  useEffect(() => {
    setLoading(true);
    fetchData(statusFilter).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, statusFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchData(statusFilter);
    setRefreshing(false);
  }

  function toggleSelect(regId: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(regId)) next.delete(regId);
      else next.add(regId);
      return next;
    });
  }

  function selectAllDone() {
    const done = registrations
      .filter((r) => r.preselection_result !== null)
      .map((r) => r.registration_id);
    setSelected(new Set(done));
  }

  async function handleSelectPlayers() {
    setSelectLoading(true);
    try {
      await api.post(`/admin/sessions/${id}/game/select-players`, {
        registration_ids: Array.from(selected),
      });
      toast.success(`${selected.size} joueur(s) sélectionné(s) avec succès.`);
      setSelectDialogOpen(false);
      setSelected(new Set());
      await fetchData(statusFilter);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        .response?.data?.message;
      toast.error(msg ?? 'Erreur lors de la sélection.');
    } finally {
      setSelectLoading(false);
    }
  }

  // ─── Render ───────────────────────────────────────────────

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
        <span className="text-foreground">Pré-sélection</span>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Résultats de pré-sélection</h1>
          <p className="text-sm text-muted-foreground">
            Classement par score décroissant, puis par temps de réponse croissant.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
          <Button
            size="sm"
            disabled={selected.size === 0}
            onClick={() => setSelectDialogOpen(true)}
          >
            <UserCheck className="mr-2 h-4 w-4" />
            Sélectionner ({selected.size})
          </Button>
        </div>
      </div>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Inscrits', value: stats.total_registered, color: 'text-blue-400' },
            { label: 'Quiz terminé', value: stats.total_done, color: 'text-green-400' },
            { label: 'En attente', value: stats.total_pending, color: 'text-yellow-400' },
            { label: 'Pas commencé', value: stats.total_not_started, color: 'text-gray-400' },
            { label: 'Sélectionnés', value: stats.total_selected, color: 'text-emerald-400' },
            { label: 'Refusés', value: stats.total_rejected, color: 'text-red-400' },
          ].map((s) => (
            <Card key={s.label} className="text-center">
              <CardContent className="pt-4">
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      {/* Filtres + tableau */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <CardTitle className="text-base">Classement</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllDone}
              disabled={loading}
            >
              <Check className="mr-2 h-4 w-4" />
              Tout cocher (quiz terminé)
            </Button>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_FILTER_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
              Aucun inscrit pour ce filtre.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>#</TableHead>
                  <TableHead>Joueur</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Temps total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {registrations.map((reg, idx) => (
                  <TableRow
                    key={reg.registration_id}
                    className={selected.has(reg.registration_id) ? 'bg-blue-950/30' : ''}
                  >
                    <TableCell>
                      {reg.preselection_result && (
                        <input
                          type="checkbox"
                          checked={selected.has(reg.registration_id)}
                          onChange={() => toggleSelect(reg.registration_id)}
                          className="h-4 w-4 accent-blue-500"
                        />
                      )}
                    </TableCell>
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
                    <TableCell>
                      <RegStatusBadge status={reg.status} />
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

      {/* Dialog confirmation sélection */}
      <Dialog open={selectDialogOpen} onOpenChange={setSelectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmer la sélection</DialogTitle>
            <DialogDescription>
              Vous allez sélectionner{' '}
              <span className="font-semibold text-foreground">{selected.size} joueur(s)</span>.
              Les anciens sélectionnés seront marqués comme refusés. Cette action
              est réversible en relançant une sélection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelectDialogOpen(false)}
              disabled={selectLoading}
            >
              Annuler
            </Button>
            <Button onClick={handleSelectPlayers} disabled={selectLoading}>
              {selectLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Confirmer la sélection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
