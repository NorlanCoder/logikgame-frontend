'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type {
  Session,
  SessionRound,
  Question,
  QuestionChoice,
  AnswerType,
  MediaType,
} from '@/lib/types';
import { toast } from 'sonner';
import {
  ROUND_TYPE_LABELS,
  ROUND_STATUS_LABELS,
  QUESTION_STATUS_LABELS,
} from '@/lib/constants';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Loader2,
  Plus,
  GripVertical,
  Check,
  X,
  Clock,
  ChevronRight,
} from 'lucide-react';

// ─── Types locaux ────────────────────────────────────────────

interface ChoiceField {
  label: string;
  is_correct: boolean;
}

interface QuestionFormState {
  text: string;
  answer_type: AnswerType;
  correct_answer: string;
  duration: number;
  display_order: number;
  media_url: string;
  media_type: MediaType;
  choices: ChoiceField[];
}

const emptyQuestionForm = (): QuestionFormState => ({
  text: '',
  answer_type: 'qcm',
  correct_answer: '',
  duration: 30,
  display_order: 1,
  media_url: '',
  media_type: 'none',
  choices: [
    { label: '', is_correct: true },
    { label: '', is_correct: false },
    { label: '', is_correct: false },
    { label: '', is_correct: false },
  ],
});

const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  qcm: 'QCM (choix multiple)',
  number: 'Nombre',
  text: 'Texte libre',
};

const QUESTION_STATUS_COLORS: Record<string, string> = {
  pending: 'secondary',
  launched: 'default',
  closed: 'outline',
  revealed: 'default',
};

// ─── Page ────────────────────────────────────────────────────

export default function AdminRoundDetailPage({
  params,
}: {
  params: Promise<{ id: string; roundId: string }>;
}) {
  const { id: sessionId, roundId } = use(params);
  const router = useRouter();

  const [sessionName, setSessionName] = useState<string>('');
  const [round, setRound] = useState<SessionRound | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Round edit dialog
  const [editRoundOpen, setEditRoundOpen] = useState(false);
  const [editRoundLoading, setEditRoundLoading] = useState(false);
  const [editRoundForm, setEditRoundForm] = useState({
    name: '',
    description: '',
    is_active: true,
  });

  // Toggle is_active inline
  const [toggleLoading, setToggleLoading] = useState(false);

  // Question dialog
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionErrors, setQuestionErrors] = useState<Record<string, string[]>>({});
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(emptyQuestionForm());

  // Delete question dialog
  const [deleteQuestionOpen, setDeleteQuestionOpen] = useState(false);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<Question | null>(null);
  const [deleteQuestionLoading, setDeleteQuestionLoading] = useState(false);

  // ─── Fetch ─────────────────────────────────────────────────

  async function fetchAll() {
    try {
      const [sessionRes, roundRes, questionsRes] = await Promise.all([
        api.get<{ data: Session }>(`/admin/sessions/${sessionId}`),
        api.get<{ data: SessionRound[] }>(`/admin/sessions/${sessionId}/rounds`),
        api.get<{ data: Question[] }>(
          `/admin/sessions/${sessionId}/rounds/${roundId}/questions`
        ),
      ]);

      const session = sessionRes.data.data ?? (sessionRes.data as unknown as Session);
      setSessionName(session.name);

      const rounds = roundRes.data.data ?? (roundRes.data as unknown as SessionRound[]);
      const found = rounds.find((r) => String(r.id) === String(roundId));
      if (!found) {
        router.replace(`/admin/sessions/${sessionId}`);
        return;
      }
      setRound(found);

      const qs = questionsRes.data.data ?? (questionsRes.data as unknown as Question[]);
      setQuestions(qs);
    } catch {
      router.replace(`/admin/sessions/${sessionId}`);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, roundId]);

  // Sync edit form
  useEffect(() => {
    if (editRoundOpen && round) {
      setEditRoundForm({
        name: round.name ?? '',
        description: round.description ?? '',
        is_active: round.is_active,
      });
    }
  }, [editRoundOpen, round]);

  // Sync question form
  useEffect(() => {
    if (questionOpen) {
      if (editingQuestion) {
        setQuestionForm({
          text: editingQuestion.text,
          answer_type: editingQuestion.answer_type,
          correct_answer: editingQuestion.correct_answer ?? '',
          duration: editingQuestion.duration,
          display_order: editingQuestion.display_order,
          media_url: editingQuestion.media_url ?? '',
          media_type: editingQuestion.media_type,
          choices:
            editingQuestion.choices && editingQuestion.choices.length > 0
              ? editingQuestion.choices.map((c) => ({
                  label: c.label,
                  is_correct: c.is_correct ?? false,
                }))
              : emptyQuestionForm().choices,
        });
      } else {
        setQuestionForm({
          ...emptyQuestionForm(),
          display_order: questions.length + 1,
        });
      }
      setQuestionErrors({});
    }
  }, [questionOpen, editingQuestion, questions.length]);

  // ─── Round handlers ────────────────────────────────────────

  async function handleToggleActive() {
    if (!round) return;
    setToggleLoading(true);
    try {
      const res = await api.patch<{ data: SessionRound }>(
        `/admin/sessions/${sessionId}/rounds/${roundId}`,
        { is_active: !round.is_active }
      );
      const updated = res.data.data ?? (res.data as unknown as SessionRound);
      setRound(updated);
      toast.success(
        updated.is_active ? 'Manche activée' : 'Manche désactivée'
      );
    } catch {
      toast.error('Impossible de modifier la manche');
    } finally {
      setToggleLoading(false);
    }
  }

  async function handleEditRound(e: React.FormEvent) {
    e.preventDefault();
    setEditRoundLoading(true);
    try {
      const res = await api.patch<{ data: SessionRound }>(
        `/admin/sessions/${sessionId}/rounds/${roundId}`,
        editRoundForm
      );
      const updated = res.data.data ?? (res.data as unknown as SessionRound);
      setRound(updated);
      setEditRoundOpen(false);
      toast.success('Manche mise à jour');
    } catch {
      toast.error('Impossible de modifier la manche');
    } finally {
      setEditRoundLoading(false);
    }
  }

  // ─── Question handlers ──────────────────────────────────────

  function buildQuestionPayload() {
    const payload: Record<string, unknown> = {
      text: questionForm.text,
      answer_type: questionForm.answer_type,
      duration: questionForm.duration,
      display_order: questionForm.display_order,
      media_type: questionForm.media_type,
    };

    if (questionForm.media_url) {
      payload.media_url = questionForm.media_url;
    }

    if (questionForm.answer_type === 'qcm') {
      payload.choices = questionForm.choices
        .filter((c) => c.label.trim() !== '')
        .map((c, i) => ({
          label: c.label,
          is_correct: c.is_correct,
          display_order: i + 1,
        }));
    } else {
      payload.correct_answer = questionForm.correct_answer;
    }

    return payload;
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setQuestionLoading(true);
    setQuestionErrors({});

    try {
      if (editingQuestion) {
        const res = await api.put<{ data: Question }>(
          `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${editingQuestion.id}`,
          buildQuestionPayload()
        );
        const updated = res.data.data ?? (res.data as unknown as Question);
        setQuestions((prev) =>
          prev.map((q) => (q.id === updated.id ? updated : q))
        );
        toast.success('Question mise à jour');
      } else {
        const res = await api.post<{ data: Question }>(
          `/admin/sessions/${sessionId}/rounds/${roundId}/questions`,
          buildQuestionPayload()
        );
        const created = res.data.data ?? (res.data as unknown as Question);
        setQuestions((prev) => [...prev, created]);
        toast.success('Question créée');
      }
      setQuestionOpen(false);
      setEditingQuestion(null);
    } catch (err: unknown) {
      const apiErr = (
        err as { response?: { data?: { errors?: Record<string, string[]> } } }
      ).response?.data;
      if (apiErr?.errors) {
        setQuestionErrors(apiErr.errors);
      }
      toast.error('Impossible d’enregistrer la question');
    } finally {
      setQuestionLoading(false);
    }
  }

  async function handleDeleteQuestion() {
    if (!deleteQuestionTarget) return;
    setDeleteQuestionLoading(true);
    try {
      await api.delete(
        `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${deleteQuestionTarget.id}`
      );
      setQuestions((prev) => prev.filter((q) => q.id !== deleteQuestionTarget.id));
      setDeleteQuestionOpen(false);
      setDeleteQuestionTarget(null);
      toast.success('Question supprimée');
    } catch {
      toast.error('Impossible de supprimer la question');
    } finally {
      setDeleteQuestionLoading(false);
    }
  }

  function openEditQuestion(q: Question) {
    setEditingQuestion(q);
    setQuestionOpen(true);
  }

  function openDeleteQuestion(q: Question) {
    setDeleteQuestionTarget(q);
    setDeleteQuestionOpen(true);
  }

  function setChoiceLabel(index: number, label: string) {
    setQuestionForm((f) => {
      const choices = [...f.choices];
      choices[index] = { ...choices[index], label };
      return { ...f, choices };
    });
  }

  function setChoiceCorrect(index: number) {
    setQuestionForm((f) => ({
      ...f,
      choices: f.choices.map((c, i) => ({ ...c, is_correct: i === index })),
    }));
  }

  function addChoice() {
    setQuestionForm((f) => ({
      ...f,
      choices: [...f.choices, { label: '', is_correct: false }],
    }));
  }

  function removeChoice(index: number) {
    setQuestionForm((f) => {
      const choices = f.choices.filter((_, i) => i !== index);
      const hasCorrect = choices.some((c) => c.is_correct);
      if (!hasCorrect && choices.length > 0) {
        choices[0].is_correct = true;
      }
      return { ...f, choices };
    });
  }

  // ─── Render ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-36" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!round) return null;

  const canEditRound = round.status === 'pending';
  const canToggleActive = round.round_number <= 4; // manches 5-8 ne peuvent pas etre desactivees

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/admin/sessions/${sessionId}`}>
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link
                href="/admin/sessions"
                className="hover:text-foreground transition-colors"
              >
                Sessions
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <Link
                href={`/admin/sessions/${sessionId}`}
                className="hover:text-foreground transition-colors"
              >
                {sessionName || `Session #${sessionId}`}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span>
                Manche {round.round_number} — {ROUND_TYPE_LABELS[round.round_type] ?? round.round_type}
              </span>
            </div>
            <h1 className="mt-0.5 text-2xl font-bold text-foreground">
              {round.name ?? ROUND_TYPE_LABELS[round.round_type] ?? round.round_type}
            </h1>
          </div>
        </div>

        {canEditRound && (
          <Dialog open={editRoundOpen} onOpenChange={setEditRoundOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <Pencil className="mr-1 h-4 w-4" />
                Modifier la manche
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Modifier la manche</DialogTitle>
                <DialogDescription>
                  Nom, description et activation de la manche.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditRound} className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="round-name">Nom personnalise</Label>
                  <Input
                    id="round-name"
                    value={editRoundForm.name}
                    onChange={(e) =>
                      setEditRoundForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder={ROUND_TYPE_LABELS[round.round_type]}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="round-desc">Description</Label>
                  <Textarea
                    id="round-desc"
                    rows={3}
                    value={editRoundForm.description}
                    onChange={(e) =>
                      setEditRoundForm((f) => ({
                        ...f,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
                {canToggleActive && (
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">Manche active</p>
                      <p className="text-xs text-muted-foreground">
                        Les manches inactives sont ignorees pendant la partie.
                      </p>
                    </div>
                    <Switch
                      checked={editRoundForm.is_active}
                      onCheckedChange={(v) =>
                        setEditRoundForm((f) => ({ ...f, is_active: v }))
                      }
                    />
                  </div>
                )}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditRoundOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={editRoundLoading}>
                    {editRoundLoading && <Loader2 className="animate-spin" />}
                    Enregistrer
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Round info */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="mt-1 font-semibold">
              {ROUND_TYPE_LABELS[round.round_type] ?? round.round_type}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Statut</p>
            <div className="mt-1">
              <Badge variant={round.status === 'in_progress' ? 'default' : 'secondary'}>
                {ROUND_STATUS_LABELS[round.status] ?? round.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground">Questions</p>
            <p className="mt-1 font-semibold">{questions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between pt-6">
            <div>
              <p className="text-xs text-muted-foreground">Active</p>
              <p className="mt-1 text-sm font-medium">
                {round.is_active ? 'Oui' : 'Non'}
              </p>
            </div>
            {canToggleActive && (
              <Switch
                checked={round.is_active}
                disabled={toggleLoading || round.status !== 'pending'}
                onCheckedChange={handleToggleActive}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {round.description && (
        <p className="text-sm text-muted-foreground">{round.description}</p>
      )}

      <Separator />

      {/* Questions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Questions</CardTitle>
              <CardDescription>
                Les questions de cette manche, dans l&apos;ordre de passage.
              </CardDescription>
            </div>
            <Dialog
              open={questionOpen}
              onOpenChange={(open) => {
                setQuestionOpen(open);
                if (!open) setEditingQuestion(null);
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-1 h-4 w-4" />
                  Ajouter
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingQuestion ? 'Modifier la question' : 'Nouvelle question'}
                  </DialogTitle>
                  <DialogDescription>
                    La question ne peut etre modifiee que si son statut est &laquo; En attente &raquo;.
                  </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSaveQuestion} className="flex flex-col gap-4">
                  {/* Texte */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="q-text">Intitule de la question</Label>
                    <Textarea
                      id="q-text"
                      rows={2}
                      value={questionForm.text}
                      onChange={(e) =>
                        setQuestionForm((f) => ({ ...f, text: e.target.value }))
                      }
                      required
                    />
                    {questionErrors.text?.[0] && (
                      <p className="text-sm text-destructive">{questionErrors.text[0]}</p>
                    )}
                  </div>

                  {/* Type + duree */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <Label>Type de reponse</Label>
                      <Select
                        value={questionForm.answer_type}
                        onValueChange={(v) =>
                          setQuestionForm((f) => ({
                            ...f,
                            answer_type: v as AnswerType,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ANSWER_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="q-duration">
                        <Clock className="mr-1 inline h-3.5 w-3.5" />
                        Duree (secondes)
                      </Label>
                      <Input
                        id="q-duration"
                        type="number"
                        min={5}
                        max={300}
                        value={questionForm.duration}
                        onChange={(e) =>
                          setQuestionForm((f) => ({
                            ...f,
                            duration: Number(e.target.value),
                          }))
                        }
                        required
                      />
                    </div>
                  </div>

                  {/* Ordre */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="q-order">
                      <GripVertical className="mr-1 inline h-3.5 w-3.5" />
                      Ordre d&apos;affichage
                    </Label>
                    <Input
                      id="q-order"
                      type="number"
                      min={1}
                      value={questionForm.display_order}
                      onChange={(e) =>
                        setQuestionForm((f) => ({
                          ...f,
                          display_order: Number(e.target.value),
                        }))
                      }
                      required
                    />
                  </div>

                  {/* Choix QCM */}
                  {questionForm.answer_type === 'qcm' && (
                    <div className="flex flex-col gap-2">
                      <Label>Choix de reponse</Label>
                      <p className="text-xs text-muted-foreground">
                        Cochez la reponse correcte.
                      </p>
                      <div className="space-y-2">
                        {questionForm.choices.map((choice, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setChoiceCorrect(i)}
                              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                                choice.is_correct
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border hover:border-primary'
                              }`}
                            >
                              {choice.is_correct && <Check className="h-3.5 w-3.5" />}
                            </button>
                            <Input
                              value={choice.label}
                              onChange={(e) => setChoiceLabel(i, e.target.value)}
                              placeholder={`Choix ${i + 1}`}
                              className="flex-1"
                            />
                            {questionForm.choices.length > 2 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 shrink-0"
                                onClick={() => removeChoice(i)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      {questionForm.choices.length < 6 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addChoice}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Ajouter un choix
                        </Button>
                      )}
                      {questionErrors['choices']?.[0] && (
                        <p className="text-sm text-destructive">
                          {questionErrors['choices'][0]}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Bonne reponse (text/number) */}
                  {questionForm.answer_type !== 'qcm' && (
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="q-answer">Reponse correcte</Label>
                      <Input
                        id="q-answer"
                        value={questionForm.correct_answer}
                        onChange={(e) =>
                          setQuestionForm((f) => ({
                            ...f,
                            correct_answer: e.target.value,
                          }))
                        }
                        type={
                          questionForm.answer_type === 'number' ? 'number' : 'text'
                        }
                        required
                      />
                      {questionErrors.correct_answer?.[0] && (
                        <p className="text-sm text-destructive">
                          {questionErrors.correct_answer[0]}
                        </p>
                      )}
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setQuestionOpen(false);
                        setEditingQuestion(null);
                      }}
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={questionLoading}>
                      {questionLoading && <Loader2 className="animate-spin" />}
                      {editingQuestion ? 'Enregistrer' : 'Creer'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>

        <CardContent>
          {questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">
                Aucune question pour cette manche.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cliquez sur &laquo; Ajouter &raquo; pour creer la premiere question.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-center">
                    <Clock className="mx-auto h-4 w-4" />
                  </TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((q, index) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {q.display_order}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate font-medium">{q.text}</p>
                        {q.choices && q.choices.length > 0 && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {q.choices.length} choix
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {ANSWER_TYPE_LABELS[q.answer_type]}
                        </span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {q.duration}s
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            (QUESTION_STATUS_COLORS[q.status] as
                              | 'default'
                              | 'secondary'
                              | 'outline'
                              | 'destructive') ?? 'secondary'
                          }
                        >
                          {QUESTION_STATUS_LABELS[q.status] ?? q.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={q.status !== 'pending'}
                            onClick={() => openEditQuestion(q)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={q.status !== 'pending'}
                            onClick={() => openDeleteQuestion(q)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete question dialog */}
      <Dialog open={deleteQuestionOpen} onOpenChange={setDeleteQuestionOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la question</DialogTitle>
            <DialogDescription>
              Etes-vous sur de vouloir supprimer cette question ? Cette action est
              irreversible.
            </DialogDescription>
          </DialogHeader>
          {deleteQuestionTarget && (
            <p className="rounded-md bg-muted p-3 text-sm">
              {deleteQuestionTarget.text}
            </p>
          )}
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDeleteQuestionOpen(false)}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteQuestion}
              disabled={deleteQuestionLoading}
            >
              {deleteQuestionLoading && <Loader2 className="animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
