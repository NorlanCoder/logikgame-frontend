'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSessionStore } from '@/stores/sessionStore';
import api from '@/lib/api';
import type { Session, SessionRound } from '@/lib/types';
import { SESSION_STATUS_LABELS, ROUND_TYPE_LABELS } from '@/lib/constants';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Image from 'next/image';
import {
  ArrowLeft,
  Calendar,
  Users,
  Trophy,
  Pencil,
  Trash2,
  Loader2,
  ListChecks,
  Check,
  Minus,
  ChevronRight,
  ImageOff,
  Play,
  DoorOpen,
  Lock,
  ClipboardList,
  Star,
  MailCheck,
  Monitor,
  Copy,
  RefreshCw,
} from 'lucide-react';

export default function AdminSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { currentSession, setCurrentSession, updateSession } = useSessionStore();
  const [loading, setLoading] = useState(true);
  const [rounds, setRounds] = useState<SessionRound[]>([]);

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string[]>>({});
  const [editForm, setEditForm] = useState({
    name: '',
    scheduled_at: '',
    max_players: 100,
    description: '',
  });
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [removeCoverImage, setRemoveCoverImage] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Lifecycle action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{
    endpoint: string;
    label: string;
    successMsg: string;
  } | null>(null);

  // Projection code state
  const [projectionCode, setProjectionCode] = useState<string | null>(null);
  const [projectionLoading, setProjectionLoading] = useState(false);

  useEffect(() => {
    async function fetchSession() {
      try {
        const res = await api.get<{ data: Session }>(`/admin/sessions/${id}`);
        const session = res.data.data ?? (res.data as unknown as Session);
        setCurrentSession(session);
        if (session.rounds) {
          setRounds(session.rounds);
        }
      } catch {
        router.replace('/admin/sessions');
      } finally {
        setLoading(false);
      }
    }

    async function fetchRounds() {
      try {
        const res = await api.get<{ data: SessionRound[] }>(
          `/admin/sessions/${id}/rounds`
        );
        setRounds(res.data.data ?? (res.data as unknown as SessionRound[]));
      } catch {
        // ignore
      }
    }

    async function fetchProjectionCode() {
      try {
        const res = await api.get<{ access_code: string }>(
          `/admin/sessions/${id}/projection`
        );
        setProjectionCode(res.data.access_code ?? null);
      } catch {
        // 404 = pas de code généré encore
        setProjectionCode(null);
      }
    }

    fetchSession();
    fetchRounds();
    fetchProjectionCode();
  }, [id, setCurrentSession, router]);

  // Sync edit form when dialog opens
  useEffect(() => {
    if (editOpen && currentSession) {
      setEditForm({
        name: currentSession.name,
        scheduled_at: currentSession.scheduled_at?.slice(0, 16) ?? '',
        max_players: currentSession.max_players,
        description: currentSession.description ?? '',
      });
      setCoverImage(null);
      setRemoveCoverImage(false);
      setEditErrors({});
    }
  }, [editOpen, currentSession]);

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    setEditErrors({});

    try {
      const fd = new FormData();
      fd.append('_method', 'PUT');
      fd.append('name', editForm.name);
      fd.append('scheduled_at', editForm.scheduled_at);
      fd.append('max_players', String(editForm.max_players));
      if (editForm.description) fd.append('description', editForm.description);
      if (coverImage) fd.append('cover_image', coverImage);
      if (removeCoverImage) fd.append('remove_cover_image', '1');
      const res = await api.post<{ data: Session }>(
        `/admin/sessions/${id}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const updated = res.data.data ?? (res.data as unknown as Session);
      setCurrentSession(updated);
      updateSession(updated);
      setEditOpen(false);
      toast.success('Session mise à jour');
    } catch (err: unknown) {
      const apiErr = (
        err as { response?: { data?: { errors?: Record<string, string[]> } } }
      ).response?.data;
      if (apiErr?.errors) {
        setEditErrors(apiErr.errors);
      }
      toast.error('Impossible de modifier la session');
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete() {
    setDeleteLoading(true);
    try {
      await api.delete(`/admin/sessions/${id}`);
      toast.success('Session supprimée');
      router.replace('/admin/sessions');
    } catch {
      toast.error('Impossible de supprimer la session');
      setDeleteLoading(false);
    }
  }

  function confirmAction(endpoint: string, label: string, successMsg: string) {
    setPendingAction({ endpoint, label, successMsg });
    setActionConfirmOpen(true);
  }

  async function executeAction() {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      const res = await api.post<{ data: Session }>(
        `/admin/sessions/${id}/game/${pendingAction.endpoint}`
      );
      const updated = res.data.data ?? (res.data as unknown as Session);
      setCurrentSession(updated);
      updateSession(updated);
      toast.success(pendingAction.successMsg);
      if (pendingAction.endpoint === 'start') {
        router.push(`/admin/sessions/${id}/game`);
        return;
      }
    } catch (err: unknown) {
      const apiErr = (
        err as { response?: { data?: { message?: string } } }
      ).response?.data;
      toast.error(apiErr?.message ?? 'Action impossible');
    } finally {
      setActionLoading(false);
      setActionConfirmOpen(false);
      setPendingAction(null);
    }
  }

  async function generateProjectionCode() {
    setProjectionLoading(true);
    try {
      const res = await api.post<{ access_code: string }>(
        `/admin/sessions/${id}/projection/generate`
      );
      setProjectionCode(res.data.access_code);
      toast.success('Code de projection généré');
    } catch {
      toast.error('Impossible de générer le code de projection');
    } finally {
      setProjectionLoading(false);
    }
  }

  function copyProjectionCode() {
    if (!projectionCode) return;
    const url = `${window.location.origin}/projection/${projectionCode}`;
    navigator.clipboard.writeText(url);
    toast.success('URL de projection copiée');
  }

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!currentSession) return null;

  const canEdit =
    currentSession.status === 'draft' ||
    currentSession.status === 'registration_open' ||
    currentSession.status === 'registration_closed' ||
    currentSession.status === 'preselection';
  const canDelete = currentSession.status === 'draft';

  const lifecycleAction = (() => {
    switch (currentSession.status) {
      case 'draft':
        return {
          endpoint: 'open-registration',
          label: 'Ouvrir les inscriptions',
          successMsg: 'Inscriptions ouvertes',
          icon: DoorOpen,
          variant: 'default' as const,
        };
      case 'registration_open':
      case 'preselection':
        return {
          endpoint: 'close-registration',
          label: 'Clôturer les inscriptions',
          successMsg: 'Inscriptions clôturées',
          icon: Lock,
          variant: 'default' as const,
        };
      case 'registration_closed':
        return {
          endpoint: 'confirm-selection',
          label: 'Confirmer la sélection',
          successMsg: 'Sélection confirmée — invitations envoyées',
          icon: MailCheck,
          variant: 'default' as const,
        };
      case 'ready':
        return {
          endpoint: 'start',
          label: 'Démarrer la session',
          successMsg: 'Session démarrée',
          icon: Play,
          variant: 'default' as const,
        };
      default:
        return null;
    }
  })();

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/sessions">
              <ArrowLeft />
            </Link>
          </Button>
          {currentSession.cover_image_url && (
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
              <Image
                src={currentSession.cover_image_url}
                alt={currentSession.name}
                fill
                className="object-cover"
                sizes="48px"
              />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {currentSession.name}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={currentSession.status} />
              {currentSession.description && (
                <span className="text-sm text-muted-foreground">
                  — {currentSession.description}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {lifecycleAction && (
            <Button
              size="sm"
              variant={lifecycleAction.variant}
              onClick={() =>
                confirmAction(
                  lifecycleAction.endpoint,
                  lifecycleAction.label,
                  lifecycleAction.successMsg
                )
              }
            >
              <lifecycleAction.icon className="mr-1 h-4 w-4" />
              {lifecycleAction.label}
            </Button>
          )}

          {(currentSession.status === 'in_progress' ||
            currentSession.status === 'ready') && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/sessions/${id}/game`}>
                <Play className="mr-1 h-4 w-4" />
                Pilotage
              </Link>
            </Button>
          )}

          {(currentSession.status === 'in_progress' ||
            currentSession.status === 'ended') && (
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/sessions/${id}/recap`}>
                <ClipboardList className="mr-1 h-4 w-4" />
                Récapitulatif
              </Link>
            </Button>
          )}

          {canEdit && (
            <Dialog open={editOpen} onOpenChange={setEditOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Pencil className="mr-1 h-4 w-4" />
                  Modifier
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Modifier la session</DialogTitle>
                  <DialogDescription>
                    Modifiez les informations générales de la session.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleEdit} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-name">Nom</Label>
                    <Input
                      id="edit-name"
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      required
                    />
                    {editErrors.name?.[0] && (
                      <p className="text-sm text-destructive">
                        {editErrors.name[0]}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-scheduled">Date et heure</Label>
                    <Input
                      id="edit-scheduled"
                      type="datetime-local"
                      value={editForm.scheduled_at}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          scheduled_at: e.target.value,
                        }))
                      }
                      required
                    />
                    {editErrors.scheduled_at?.[0] && (
                      <p className="text-sm text-destructive">
                        {editErrors.scheduled_at[0]}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-max">Nombre max de joueurs</Label>
                    <Input
                      id="edit-max"
                      type="number"
                      min={2}
                      max={1000}
                      value={editForm.max_players}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          max_players: Number(e.target.value),
                        }))
                      }
                      required
                    />
                    {editErrors.max_players?.[0] && (
                      <p className="text-sm text-destructive">
                        {editErrors.max_players[0]}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-desc">Description</Label>
                    <Textarea
                      id="edit-desc"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          description: e.target.value,
                        }))
                      }
                      rows={3}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="edit-cover">Image de couverture</Label>
                    {currentSession?.cover_image_url && !removeCoverImage ? (
                      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                        <span className="flex-1 truncate text-muted-foreground">
                          {currentSession.cover_image_url.split('/').pop()}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-destructive hover:text-destructive"
                          onClick={() => {
                            setRemoveCoverImage(true);
                            setCoverImage(null);
                          }}
                        >
                          <ImageOff className="h-3.5 w-3.5" />
                          Supprimer
                        </Button>
                      </div>
                    ) : (
                      <Input
                        id="edit-cover"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          setCoverImage(e.target.files?.[0] ?? null);
                          setRemoveCoverImage(false);
                        }}
                      />
                    )}
                    {editErrors.cover_image?.[0] && (
                      <p className="text-sm text-destructive">
                        {editErrors.cover_image[0]}
                      </p>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditOpen(false)}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={editLoading}>
                      {editLoading && <Loader2 className="animate-spin" />}
                      Enregistrer
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {canDelete && (
            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="mr-1 h-4 w-4" />
                  Supprimer
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Supprimer la session</DialogTitle>
                  <DialogDescription>
                    Êtes-vous sûr de vouloir supprimer la session &laquo;{' '}
                    {currentSession.name} &raquo; ? Cette action est
                    irréversible.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleteOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleteLoading}
                  >
                    {deleteLoading && <Loader2 className="animate-spin" />}
                    Supprimer définitivement
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date prévue</p>
              <p className="font-semibold">
                {new Date(currentSession.scheduled_at).toLocaleDateString(
                  'fr-FR',
                  { dateStyle: 'long' }
                )}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Joueurs</p>
              <p className="font-semibold">
                {currentSession.players_remaining} / {currentSession.max_players}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cagnotte</p>
              <p className="font-semibold">
                {(currentSession.jackpot ?? 0).toLocaleString('fr-FR')} pts
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <ListChecks className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inscriptions</p>
              <p className="font-semibold">
                {currentSession.registrations_count ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Rounds table */}

      
      {/* Pré-sélection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Pré-sélection</CardTitle>
              <CardDescription>
                Gérez les questions, consultez les résultats et les joueurs sélectionnés.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/sessions/${id}/preselection`}>
                  <ListChecks className="mr-1 h-4 w-4" />
                  Questions
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/sessions/${id}/preselection/registrations`}>
                  <ClipboardList className="mr-1 h-4 w-4" />
                  Résultats
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/sessions/${id}/preselection/selected`}>
                  <Star className="mr-1 h-4 w-4" />
                  Sélectionnés
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Projection */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="h-5 w-5" />
                Projection
              </CardTitle>
              <CardDescription>
                Code d&apos;accès pour l&apos;écran de projection publique.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {projectionCode ? (
                <>
                  <div className="flex flex-col gap-1">
                    <code className="rounded-md bg-muted px-3 py-1.5 text-lg font-mono font-bold tracking-widest">
                      {projectionCode}
                    </code>
                    <span className="text-xs text-muted-foreground">
                      /projection/{projectionCode}
                    </span>
                  </div>
                  <Button variant="outline" size="icon" onClick={copyProjectionCode} title="Copier">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generateProjectionCode}
                    disabled={projectionLoading}
                  >
                    {projectionLoading ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1 h-4 w-4" />
                    )}
                    Régénérer
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  onClick={generateProjectionCode}
                  disabled={projectionLoading}
                >
                  {projectionLoading && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Générer un code
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manches</CardTitle>
          <CardDescription>
            Les 8 manches de la session, du 1er tour à la finale.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-center">Active</TableHead>
                <TableHead className="text-center">Questions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rounds.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground"
                  >
                    Aucune manche configurée.
                  </TableCell>
                </TableRow>
              ) : (
                rounds.map((round) => (
                  <TableRow key={round.id}>
                    <TableCell className="font-medium">
                      {round.round_number}
                    </TableCell>
                    <TableCell>
                      {ROUND_TYPE_LABELS[round.round_type] ?? round.round_type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          round.status === 'completed'
                            ? 'default'
                            : round.status === 'in_progress'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {round.status === 'pending'
                          ? 'En attente'
                          : round.status === 'in_progress'
                            ? 'En cours'
                            : round.status === 'completed'
                              ? 'Terminé'
                              : 'Ignoré'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {round.is_active ? (
                        <Check className="mx-auto h-4 w-4 text-green-600" />
                      ) : (
                        <Minus className="mx-auto h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {round.questions_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          href={`/admin/sessions/${id}/rounds/${round.id}`}
                        >
                          Gerer
                          <ChevronRight className="ml-1 h-4 w-4" />
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Action confirmation dialog */}
      <Dialog open={actionConfirmOpen} onOpenChange={setActionConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pendingAction?.label}</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir effectuer cette action pour la session
              &laquo; {currentSession.name} &raquo; ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setActionConfirmOpen(false)}
            >
              Annuler
            </Button>
            <Button onClick={executeAction} disabled={actionLoading}>
              {actionLoading && <Loader2 className="animate-spin" />}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

