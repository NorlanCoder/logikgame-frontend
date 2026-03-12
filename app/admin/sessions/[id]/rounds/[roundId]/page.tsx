'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type {
  Session,
  SessionRound,
  Question,
  QuestionHint,
  SecondChanceQuestion,
  AnswerType,
  HintType,
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
  Check,
  X,
  Clock,
  ChevronRight,
  Upload,
  ImageOff,
  Lightbulb,
  ShieldCheck,
  Info,
  Copy,
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
  media_file: File | null;
  remove_media: boolean;
  choices: ChoiceField[];
}

const emptyQuestionForm = (): QuestionFormState => ({
  text: '',
  answer_type: 'qcm',
  correct_answer: '',
  duration: 30,
  display_order: 1,
  media_file: null,
  remove_media: false,
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
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);

  // Delete question dialog
  const [deleteQuestionOpen, setDeleteQuestionOpen] = useState(false);
  const [deleteQuestionTarget, setDeleteQuestionTarget] = useState<Question | null>(null);
  const [deleteQuestionLoading, setDeleteQuestionLoading] = useState(false);

  // Hint dialog
  const [hintOpen, setHintOpen] = useState(false);
  const [hintLoading, setHintLoading] = useState(false);
  const [hintErrors, setHintErrors] = useState<Record<string, string[]>>({});
  const [hintTarget, setHintTarget] = useState<Question | null>(null);
  const [hintForm, setHintForm] = useState({
    hint_type: 'remove_choices' as HintType,
    time_penalty_seconds: 5,
    removed_choice_ids: [] as number[],
    revealed_letters: '' as string,
    range_hint_text: '',
    range_min: '' as string | number,
    range_max: '' as string | number,
  });

  // Second chance dialog
  const [scOpen, setScOpen] = useState(false);
  const [scLoading, setScLoading] = useState(false);
  const [scErrors, setScErrors] = useState<Record<string, string[]>>({});
  const [scTarget, setScTarget] = useState<Question | null>(null);
  const [scForm, setScForm] = useState<QuestionFormState>(emptyQuestionForm());
  const [scMediaPreviewUrl, setScMediaPreviewUrl] = useState<string | null>(null);

  // ─── Fetch ─────────────────────────────────────────────────

  async function fetchAll() {
    try {
      const [sessionRes, roundRes, questionsRes] = await Promise.all([
        api.get<{ data: Session }>(`/admin/sessions/${sessionId}`),
        api.get<{ data: SessionRound[] }>(`/admin/sessions/${sessionId}/rounds`),
        api.get<{ round: SessionRound; data: Question[] }>(
          `/admin/sessions/${sessionId}/rounds/${roundId}/questions`
        ),
      ]);

      const session = sessionRes.data.data ?? (sessionRes.data as unknown as Session);
      setSessionName(session.name);

      // Use round info from questions endpoint if available, fallback to rounds list
      const qRes = questionsRes.data as { round?: SessionRound; data?: Question[] };
      if (qRes.round) {
        setRound(qRes.round);
      } else {
        const rounds = roundRes.data.data ?? (roundRes.data as unknown as SessionRound[]);
        const found = rounds.find((r) => String(r.id) === String(roundId));
        if (!found) {
          router.replace(`/admin/sessions/${sessionId}`);
          return;
        }
        setRound(found);
      }

      const qs = qRes.data ?? (questionsRes.data as unknown as Question[]);
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
          media_file: null,
          remove_media: false,
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
      setMediaPreviewUrl(null);
    }
  }, [questionOpen, editingQuestion, questions.length]);

  useEffect(() => {
    return () => {
      if (mediaPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(mediaPreviewUrl);
    };
  }, [mediaPreviewUrl]);

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

  function buildQuestionFormData(isUpdate = false): FormData {
    const fd = new FormData();
    if (isUpdate) fd.append('_method', 'PUT');
    fd.append('text', questionForm.text);
    fd.append('answer_type', questionForm.answer_type);
    fd.append('duration', String(questionForm.duration));
    fd.append('display_order', String(questionForm.display_order));

    if (isUpdate && questionForm.remove_media) {
      fd.append('remove_media', 'true');
    } else if (questionForm.media_file) {
      fd.append('media_file', questionForm.media_file);
    }

    if (questionForm.answer_type === 'qcm') {
      const choices = questionForm.choices.filter((c) => c.label.trim() !== '');
      choices.forEach((c, i) => {
        fd.append(`choices[${i}][label]`, c.label);
        fd.append(`choices[${i}][is_correct]`, c.is_correct ? '1' : '0');
        fd.append(`choices[${i}][display_order]`, String(i + 1));
      });
    } else {
      fd.append('correct_answer', questionForm.correct_answer);
    }

    return fd;
  }

  async function handleSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    setQuestionLoading(true);
    setQuestionErrors({});

    try {
      if (editingQuestion) {
        const res = await api.post<{ data: Question }>(
          `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${editingQuestion.id}`,
          buildQuestionFormData(true),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const updated = res.data.data ?? (res.data as unknown as Question);
        setQuestions((prev) =>
          prev.map((q) => (q.id === updated.id ? updated : q))
        );
        toast.success('Question mise à jour');
      } else {
        const res = await api.post<{ data: Question }>(
          `/admin/sessions/${sessionId}/rounds/${roundId}/questions`,
          buildQuestionFormData(false),
          { headers: { 'Content-Type': 'multipart/form-data' } }
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

  async function handleDuplicateQuestion(q: Question) {
    try {
      const { data } = await api.post(
        `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${q.id}/duplicate`
      );
      setQuestions((prev) => [...prev, data]);
      toast.success('Question dupliquée');
    } catch {
      toast.error('Impossible de dupliquer la question');
    }
  }

  // ─── Hint handlers ──────────────────────────────────────────

  function openHintDialog(q: Question) {
    setHintTarget(q);
    if (q.hint) {
      setHintForm({
        hint_type: q.hint.hint_type,
        time_penalty_seconds: q.hint.time_penalty_seconds ?? 5,
        removed_choice_ids: q.hint.removed_choice_ids ?? [],
        revealed_letters: (q.hint.revealed_letters ?? []).join(', '),
        range_hint_text: q.hint.range_hint_text ?? '',
        range_min: q.hint.range_min ?? '',
        range_max: q.hint.range_max ?? '',
      });
    } else {
      setHintForm({
        hint_type: q.answer_type === 'qcm' ? 'remove_choices' : q.answer_type === 'text' ? 'reveal_letters' : 'reduce_range',
        time_penalty_seconds: 5,
        removed_choice_ids: [],
        revealed_letters: '',
        range_hint_text: '',
        range_min: '',
        range_max: '',
      });
    }
    setHintErrors({});
    setHintOpen(true);
  }

  async function handleSaveHint(e: React.FormEvent) {
    e.preventDefault();
    if (!hintTarget) return;
    setHintLoading(true);
    setHintErrors({});

    const body: Record<string, unknown> = {
      hint_type: hintForm.hint_type,
      time_penalty_seconds: hintForm.time_penalty_seconds,
    };

    if (hintForm.hint_type === 'remove_choices') {
      body.removed_choice_ids = hintForm.removed_choice_ids;
    } else if (hintForm.hint_type === 'reveal_letters') {
      body.revealed_letters = hintForm.revealed_letters
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      body.range_hint_text = hintForm.range_hint_text;
      body.range_min = hintForm.range_min !== '' ? Number(hintForm.range_min) : null;
      body.range_max = hintForm.range_max !== '' ? Number(hintForm.range_max) : null;
    }

    try {
      const res = await api.put<{ data: QuestionHint }>(
        `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${hintTarget.id}/hint`,
        body
      );
      const hint = res.data.data ?? (res.data as unknown as QuestionHint);
      setQuestions((prev) =>
        prev.map((q) => (q.id === hintTarget.id ? { ...q, hint } : q))
      );
      setHintOpen(false);
      setHintTarget(null);
      toast.success('Indice configuré');
    } catch (err: unknown) {
      const apiErr = (
        err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }
      ).response?.data;
      if (apiErr?.errors) {
        setHintErrors(apiErr.errors);
      }
      toast.error(apiErr?.message ?? 'Impossible de configurer l\u2019indice');
    } finally {
      setHintLoading(false);
    }
  }

  async function handleDeleteHint() {
    if (!hintTarget) return;
    setHintLoading(true);
    try {
      await api.delete(
        `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${hintTarget.id}/hint`
      );
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === hintTarget.id ? { ...q, hint: undefined } : q
        )
      );
      setHintOpen(false);
      setHintTarget(null);
      toast.success('Indice supprimé');
    } catch {
      toast.error('Impossible de supprimer l\u2019indice');
    } finally {
      setHintLoading(false);
    }
  }

  // ─── Second chance handlers ─────────────────────────────────

  function openScDialog(q: Question) {
    setScTarget(q);
    if (q.second_chance_question) {
      const sc = q.second_chance_question;
      setScForm({
        text: sc.text,
        answer_type: sc.answer_type,
        correct_answer: sc.correct_answer ?? '',
        duration: sc.duration,
        display_order: 1,
        media_file: null,
        remove_media: false,
        choices:
          sc.choices && sc.choices.length > 0
            ? sc.choices.map((c) => ({ label: c.label, is_correct: !!c.is_correct }))
            : emptyQuestionForm().choices,
      });
      setScMediaPreviewUrl(null);
    } else {
      setScForm(emptyQuestionForm());
      setScMediaPreviewUrl(null);
    }
    setScErrors({});
    setScOpen(true);
  }

  async function handleSaveSc(e: React.FormEvent) {
    e.preventDefault();
    if (!scTarget) return;
    setScLoading(true);
    setScErrors({});

    const fd = new FormData();
    fd.append('_method', 'PUT');
    fd.append('text', scForm.text);
    fd.append('answer_type', scForm.answer_type);
    fd.append('duration', String(scForm.duration));

    if (scForm.remove_media) {
      fd.append('remove_media', 'true');
    } else if (scForm.media_file) {
      fd.append('media_file', scForm.media_file);
    }

    if (scForm.answer_type === 'qcm') {
      const choices = scForm.choices.filter((c) => c.label.trim() !== '');
      choices.forEach((c, i) => {
        fd.append(`choices[${i}][label]`, c.label);
        fd.append(`choices[${i}][is_correct]`, c.is_correct ? '1' : '0');
        fd.append(`choices[${i}][display_order]`, String(i + 1));
      });
    } else {
      fd.append('correct_answer', scForm.correct_answer);
      if (scForm.answer_type === 'number') {
        fd.append('number_is_decimal', scForm.correct_answer.includes('.') ? '1' : '0');
      }
    }

    try {
      const res = await api.post<{ data: SecondChanceQuestion }>(
        `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${scTarget.id}/second-chance`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      const sc = res.data.data ?? (res.data as unknown as SecondChanceQuestion);
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === scTarget.id ? { ...q, second_chance_question: sc } : q
        )
      );
      setScOpen(false);
      setScTarget(null);
      toast.success('Question de seconde chance configurée');
    } catch (err: unknown) {
      const apiErr = (
        err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }
      ).response?.data;
      if (apiErr?.errors) {
        setScErrors(apiErr.errors);
      }
      toast.error(apiErr?.message ?? 'Impossible de configurer la seconde chance');
    } finally {
      setScLoading(false);
    }
  }

  async function handleDeleteSc() {
    if (!scTarget) return;
    setScLoading(true);
    try {
      await api.delete(
        `/admin/sessions/${sessionId}/rounds/${roundId}/questions/${scTarget.id}/second-chance`
      );
      setQuestions((prev) =>
        prev.map((q) =>
          q.id === scTarget.id ? { ...q, second_chance_question: null } : q
        )
      );
      setScOpen(false);
      setScTarget(null);
      toast.success('Question de seconde chance supprimée');
    } catch {
      toast.error('Impossible de supprimer la question de seconde chance');
    } finally {
      setScLoading(false);
    }
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

                  {/* Ordre (auto-calculé, masqué) */}

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

                  {/* Media */}
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="q-media">Média (optionnel)</Label>
                    {editingQuestion?.media_url && !questionForm.remove_media && (
                      <>
                        <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                          <span className="flex-1 truncate text-muted-foreground">
                            {editingQuestion.media_url.split('/').pop()}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-destructive hover:text-destructive"
                            onClick={() => {
                              setQuestionForm((f) => ({
                                ...f,
                                remove_media: true,
                                media_file: null,
                              }));
                              setMediaPreviewUrl(null);
                            }}
                          >
                            <ImageOff className="h-3.5 w-3.5" />
                            Supprimer
                          </Button>
                        </div>
                        {editingQuestion.media_type === 'image' && (
                          <img
                            src={editingQuestion.media_url}
                            alt="aperçu"
                            className="max-h-48 w-full rounded-md object-contain bg-muted"
                          />
                        )}
                        {editingQuestion.media_type === 'video' && (
                          <video
                            src={editingQuestion.media_url}
                            controls
                            className="max-h-48 w-full rounded-md"
                          />
                        )}
                        {editingQuestion.media_type === 'audio' && (
                          <audio
                            src={editingQuestion.media_url}
                            controls
                            className="w-full"
                          />
                        )}
                      </>
                    )}
                    {(!editingQuestion?.media_url || questionForm.remove_media) && (
                      <>
                        <Input
                          id="q-media"
                          type="file"
                          accept="image/*,video/*,audio/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0] ?? null;
                            setQuestionForm((f) => ({
                              ...f,
                              media_file: file,
                              remove_media: false,
                            }));
                            setMediaPreviewUrl(
                              file ? URL.createObjectURL(file) : null
                            );
                          }}
                        />
                        {questionForm.media_file && mediaPreviewUrl && (
                          <>
                            {questionForm.media_file.type.startsWith('image/') && (
                              <img
                                src={mediaPreviewUrl}
                                alt="aperçu"
                                className="max-h-48 w-full rounded-md object-contain bg-muted"
                              />
                            )}
                            {questionForm.media_file.type.startsWith('video/') && (
                              <video
                                src={mediaPreviewUrl}
                                controls
                                className="max-h-48 w-full rounded-md"
                              />
                            )}
                            {questionForm.media_file.type.startsWith('audio/') && (
                              <audio
                                src={mediaPreviewUrl}
                                controls
                                className="w-full"
                              />
                            )}
                          </>
                        )}
                      </>
                    )}
                    {questionErrors.media_file?.[0] && (
                      <p className="text-sm text-destructive">
                        {questionErrors.media_file[0]}
                      </p>
                    )}
                  </div>

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
                  {(round.round_type === 'hint' || round.round_type === 'second_chance') && (
                    <TableHead>Configuré</TableHead>
                  )}
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
                      {round.round_type === 'hint' && (
                        <TableCell>
                          {q.hint ? (
                            <span className="inline-flex items-center gap-1 text-xs text-yellow-600">
                              <Lightbulb className="h-3.5 w-3.5" />
                              {q.hint.hint_type === 'remove_choices' && 'Retirer choix'}
                              {q.hint.hint_type === 'reveal_letters' && 'Révéler lettres'}
                              {q.hint.hint_type === 'reduce_range' && 'Fourchette'}
                              <span className="text-muted-foreground">({q.hint.time_penalty_seconds}s)</span>
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Non configuré</span>
                          )}
                        </TableCell>
                      )}
                      {round.round_type === 'second_chance' && (
                        <TableCell>
                          {q.second_chance_question ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              2e chance
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Non configuré</span>
                          )}
                        </TableCell>
                      )}
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
                          {round.round_type === 'hint' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openHintDialog(q)}
                              title="Configurer l'indice"
                            >
                              <Lightbulb
                                className={`h-4 w-4 ${
                                  q.hint
                                    ? 'text-yellow-500'
                                    : 'text-muted-foreground'
                                }`}
                              />
                            </Button>
                          )}
                          {round.round_type === 'second_chance' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openScDialog(q)}
                              title="Question de seconde chance"
                            >
                              <ShieldCheck
                                className={`h-4 w-4 ${
                                  q.second_chance_question
                                    ? 'text-blue-500'
                                    : 'text-muted-foreground'
                                }`}
                              />
                            </Button>
                          )}
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
                            onClick={() => handleDuplicateQuestion(q)}
                            title="Dupliquer la question"
                          >
                            <Copy className="h-4 w-4" />
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
      {/* Hint dialog */}
      <Dialog open={hintOpen} onOpenChange={setHintOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              <Lightbulb className="mr-2 inline h-5 w-5 text-yellow-500" />
              Configurer l&apos;indice
            </DialogTitle>
            <DialogDescription>
              {hintTarget?.text}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveHint} className="flex flex-col gap-4">
            {/* Type d'indice (auto-déterminé) */}
            <div className="flex flex-col gap-2">
              <Label>Type d&apos;indice</Label>
              <p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
                {hintForm.hint_type === 'remove_choices' && 'Retirer des choix (QCM)'}
                {hintForm.hint_type === 'reveal_letters' && 'Révéler des lettres (Texte)'}
                {hintForm.hint_type === 'reduce_range' && 'Réduire la fourchette (Nombre)'}
              </p>
            </div>

            {/* Pénalité temps */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="hint-penalty">
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                Pénalité temps (secondes)
              </Label>
              <Input
                id="hint-penalty"
                type="number"
                min={0}
                max={120}
                value={hintForm.time_penalty_seconds}
                onChange={(e) =>
                  setHintForm((f) => ({
                    ...f,
                    time_penalty_seconds: Number(e.target.value),
                  }))
                }
              />
              {hintErrors.time_penalty_seconds?.[0] && (
                <p className="text-sm text-destructive">
                  {hintErrors.time_penalty_seconds[0]}
                </p>
              )}
            </div>

            {/* remove_choices */}
            {hintForm.hint_type === 'remove_choices' && hintTarget?.choices && (
              <div className="flex flex-col gap-2">
                <Label>Choix à retirer</Label>
                <p className="text-xs text-muted-foreground">
                  Cochez les choix qui seront masqués lorsque le joueur active l&apos;indice.
                </p>
                <div className="flex flex-col gap-1.5">
                  {hintTarget.choices.map((c) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={hintForm.removed_choice_ids.includes(c.id)}
                        onChange={(e) => {
                          setHintForm((f) => ({
                            ...f,
                            removed_choice_ids: e.target.checked
                              ? [...f.removed_choice_ids, c.id]
                              : f.removed_choice_ids.filter((id) => id !== c.id),
                          }));
                        }}
                        className="h-4 w-4 rounded border-muted-foreground"
                      />
                      <span className={c.is_correct ? 'font-medium text-green-600' : ''}>
                        {c.label}
                        {c.is_correct && ' ✓'}
                      </span>
                    </label>
                  ))}
                </div>
                {hintErrors.removed_choice_ids?.[0] && (
                  <p className="text-sm text-destructive">
                    {hintErrors.removed_choice_ids[0]}
                  </p>
                )}
              </div>
            )}

            {/* reveal_letters */}
            {hintForm.hint_type === 'reveal_letters' && hintTarget?.correct_answer && (
              <div className="flex flex-col gap-2">
                <Label>Lettres à révéler</Label>
                <p className="text-xs text-muted-foreground">
                  Cliquez sur les lettres de la réponse à dévoiler comme indice.
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {hintTarget.correct_answer.split('').map((char, i) => {
                    const pos = String(i + 1);
                    const selected = hintForm.revealed_letters
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .includes(pos);
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setHintForm((f) => {
                            const current = f.revealed_letters
                              .split(',')
                              .map((s) => s.trim())
                              .filter(Boolean);
                            const next = selected
                              ? current.filter((p) => p !== pos)
                              : [...current, pos];
                            return {
                              ...f,
                              revealed_letters: next.join(', '),
                            };
                          });
                        }}
                        className={`flex h-9 w-9 items-center justify-center rounded-md border text-sm font-mono transition-colors ${
                          char === ' '
                            ? 'border-transparent cursor-default'
                            : selected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30 hover:border-primary hover:bg-muted/50'
                        }`}
                        disabled={char === ' '}
                        title={char === ' ' ? 'Espace' : `Position ${i + 1}`}
                      >
                        {char === ' ' ? '·' : char.toUpperCase()}
                      </button>
                    );
                  })}
                </div>
                {hintForm.revealed_letters && (
                  <p className="text-xs text-muted-foreground">
                    Positions sélectionnées : {hintForm.revealed_letters}
                  </p>
                )}
                {hintErrors.revealed_letters?.[0] && (
                  <p className="text-sm text-destructive">
                    {hintErrors.revealed_letters[0]}
                  </p>
                )}
              </div>
            )}

            {/* range */}
            {hintForm.hint_type === 'reduce_range' && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="hint-range-text">Texte d&apos;indice</Label>
                  <Input
                    id="hint-range-text"
                    value={hintForm.range_hint_text}
                    onChange={(e) =>
                      setHintForm((f) => ({ ...f, range_hint_text: e.target.value }))
                    }
                    placeholder='Ex: "Entre 50 et 100"'
                  />
                  {hintErrors.range_hint_text?.[0] && (
                    <p className="text-sm text-destructive">
                      {hintErrors.range_hint_text[0]}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="hint-range-min">Min</Label>
                    <Input
                      id="hint-range-min"
                      type="number"
                      value={hintForm.range_min}
                      onChange={(e) =>
                        setHintForm((f) => ({ ...f, range_min: e.target.value }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="hint-range-max">Max</Label>
                    <Input
                      id="hint-range-max"
                      type="number"
                      value={hintForm.range_max}
                      onChange={(e) =>
                        setHintForm((f) => ({ ...f, range_max: e.target.value }))
                      }
                    />
                  </div>
                </div>
                {(hintErrors.range_min?.[0] || hintErrors.range_max?.[0]) && (
                  <p className="text-sm text-destructive">
                    {hintErrors.range_min?.[0] || hintErrors.range_max?.[0]}
                  </p>
                )}
              </>
            )}

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {hintTarget?.hint && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteHint}
                  disabled={hintLoading}
                  className="mr-auto"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Supprimer l&apos;indice
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setHintOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={hintLoading}>
                {hintLoading && <Loader2 className="animate-spin" />}
                {hintTarget?.hint ? 'Mettre à jour' : 'Créer l\u2019indice'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Second chance dialog */}
      <Dialog open={scOpen} onOpenChange={setScOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {scTarget?.second_chance_question
                ? 'Modifier la question de seconde chance'
                : 'Créer une question de seconde chance'}
            </DialogTitle>
            <DialogDescription>
              Question de rattrapage pour : {scTarget?.text}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveSc} className="flex flex-col gap-4">
            {/* Texte */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="sc-text">Énoncé</Label>
              <Textarea
                id="sc-text"
                rows={2}
                value={scForm.text}
                onChange={(e) =>
                  setScForm((f) => ({ ...f, text: e.target.value }))
                }
                placeholder="Question de rattrapage..."
              />
              {scErrors.text?.[0] && (
                <p className="text-sm text-destructive">{scErrors.text[0]}</p>
              )}
            </div>

            {/* Type de réponse */}
            <div className="flex flex-col gap-2">
              <Label>Type de réponse</Label>
              <Select
                value={scForm.answer_type}
                onValueChange={(v) =>
                  setScForm((f) => ({
                    ...f,
                    answer_type: v as AnswerType,
                    correct_answer: '',
                    choices:
                      v === 'qcm'
                        ? emptyQuestionForm().choices
                        : f.choices,
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

            {/* Durée */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="sc-duration">
                <Clock className="mr-1 inline h-3.5 w-3.5" />
                Durée (secondes)
              </Label>
              <Input
                id="sc-duration"
                type="number"
                min={5}
                max={300}
                value={scForm.duration}
                onChange={(e) =>
                  setScForm((f) => ({
                    ...f,
                    duration: Number(e.target.value),
                  }))
                }
              />
              {scErrors.duration?.[0] && (
                <p className="text-sm text-destructive">{scErrors.duration[0]}</p>
              )}
            </div>

            {/* Réponse correcte (text / number) */}
            {scForm.answer_type !== 'qcm' && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="sc-correct-answer">
                  Réponse correcte
                  {scForm.answer_type === 'number' && ' (nombre)'}
                </Label>
                <Input
                  id="sc-correct-answer"
                  type={scForm.answer_type === 'number' ? 'number' : 'text'}
                  step={scForm.answer_type === 'number' ? 'any' : undefined}
                  value={scForm.correct_answer}
                  onChange={(e) =>
                    setScForm((f) => ({ ...f, correct_answer: e.target.value }))
                  }
                />
                {scErrors.correct_answer?.[0] && (
                  <p className="text-sm text-destructive">
                    {scErrors.correct_answer[0]}
                  </p>
                )}
              </div>
            )}

            {/* Choix QCM */}
            {scForm.answer_type === 'qcm' && (
              <div className="flex flex-col gap-2">
                <Label>Choix</Label>
                <div className="flex flex-col gap-2">
                  {scForm.choices.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setScForm((f) => ({
                            ...f,
                            choices: f.choices.map((ch, j) => ({
                              ...ch,
                              is_correct: j === i,
                            })),
                          }))
                        }
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          c.is_correct
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-muted-foreground/30 hover:border-green-500'
                        }`}
                        title="Marquer comme bonne réponse"
                      >
                        {c.is_correct && <Check className="h-3.5 w-3.5" />}
                      </button>
                      <Input
                        value={c.label}
                        onChange={(e) =>
                          setScForm((f) => ({
                            ...f,
                            choices: f.choices.map((ch, j) =>
                              j === i ? { ...ch, label: e.target.value } : ch
                            ),
                          }))
                        }
                        placeholder={`Choix ${i + 1}`}
                        className="flex-1"
                      />
                      {scForm.choices.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setScForm((f) => {
                              const choices = f.choices.filter((_, j) => j !== i);
                              if (!choices.some((ch) => ch.is_correct) && choices.length > 0)
                                choices[0].is_correct = true;
                              return { ...f, choices };
                            })
                          }
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {scForm.choices.length < 6 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setScForm((f) => ({
                        ...f,
                        choices: [...f.choices, { label: '', is_correct: false }],
                      }))
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" />
                    Ajouter un choix
                  </Button>
                )}
                {scErrors.choices?.[0] && (
                  <p className="text-sm text-destructive">{scErrors.choices[0]}</p>
                )}
              </div>
            )}

            {/* Média */}
            <div className="flex flex-col gap-2">
              <Label>Média (optionnel)</Label>
              {/* Média existant */}
              {scTarget?.second_chance_question?.media_url &&
                scTarget.second_chance_question.media_type !== 'none' &&
                !scForm.remove_media &&
                !scMediaPreviewUrl && (
                  <div className="flex flex-col gap-2">
                    {scTarget.second_chance_question.media_type === 'image' && (
                      <img
                        src={scTarget.second_chance_question.media_url}
                        alt="Média actuel"
                        className="max-h-32 rounded-md object-contain"
                      />
                    )}
                    {scTarget.second_chance_question.media_type === 'video' && (
                      <video
                        controls
                        src={scTarget.second_chance_question.media_url}
                        className="max-h-32 rounded-md"
                      />
                    )}
                    {scTarget.second_chance_question.media_type === 'audio' && (
                      <audio
                        controls
                        src={scTarget.second_chance_question.media_url}
                      />
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setScForm((f) => ({ ...f, remove_media: true }))}
                    >
                      <ImageOff className="mr-1 h-3.5 w-3.5" />
                      Retirer le média
                    </Button>
                  </div>
                )}
              {scForm.remove_media && (
                <p className="text-xs text-muted-foreground italic">
                  Le média sera supprimé.{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => setScForm((f) => ({ ...f, remove_media: false }))}
                  >
                    Annuler
                  </button>
                </p>
              )}
              {/* Preview nouveau fichier */}
              {scMediaPreviewUrl && (
                <img
                  src={scMediaPreviewUrl}
                  alt="Aperçu"
                  className="max-h-32 rounded-md object-contain"
                />
              )}
              <Input
                type="file"
                accept="image/*,video/*,audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setScForm((f) => ({ ...f, media_file: file, remove_media: false }));
                  if (scMediaPreviewUrl) URL.revokeObjectURL(scMediaPreviewUrl);
                  setScMediaPreviewUrl(
                    file && file.type.startsWith('image/')
                      ? URL.createObjectURL(file)
                      : null
                  );
                }}
              />
              {scErrors.media_file?.[0] && (
                <p className="text-sm text-destructive">{scErrors.media_file[0]}</p>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {scTarget?.second_chance_question && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSc}
                  disabled={scLoading}
                  className="mr-auto"
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Supprimer
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                onClick={() => setScOpen(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={scLoading}>
                {scLoading && <Loader2 className="animate-spin" />}
                {scTarget?.second_chance_question ? 'Mettre à jour' : 'Créer'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
