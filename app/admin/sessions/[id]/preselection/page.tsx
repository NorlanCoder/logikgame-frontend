'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import type { Session, PreselectionQuestion, AnswerType } from '@/lib/types';
import { toast } from 'sonner';
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
  ChevronRight,
  X,
  Check,
  HelpCircle,
  ImageOff,
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
  display_order: number;
  media_file: File | null;
  remove_media: boolean;
  choices: ChoiceField[];
}

const emptyForm = (): QuestionFormState => ({
  text: '',
  answer_type: 'qcm',
  correct_answer: '',
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

// ─── Page ────────────────────────────────────────────────────

export default function AdminPreselectionQuestionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: sessionId } = use(params);
  const router = useRouter();

  const [sessionName, setSessionName] = useState<string>('');
  const [questions, setQuestions] = useState<PreselectionQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog état
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionErrors, setQuestionErrors] = useState<Record<string, string[]>>({});
  const [editingQuestion, setEditingQuestion] = useState<PreselectionQuestion | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionFormState>(emptyForm());
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PreselectionQuestion | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ─── Fetch ──────────────────────────────────────────────────

  async function fetchAll() {
    try {
      const [sessionRes, questionsRes] = await Promise.all([
        api.get<{ data: Session }>(`/admin/sessions/${sessionId}`),
        api.get<{ data: PreselectionQuestion[] }>(
          `/admin/sessions/${sessionId}/preselection-questions`
        ),
      ]);

      const session = sessionRes.data.data ?? (sessionRes.data as unknown as Session);
      setSessionName(session.name);

      const qs =
        questionsRes.data.data ??
        (questionsRes.data as unknown as PreselectionQuestion[]);
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
  }, [sessionId]);

  // Sync form quand dialog s'ouvre
  useEffect(() => {
    if (questionOpen) {
      if (editingQuestion) {
        setQuestionForm({
          text: editingQuestion.text,
          answer_type: editingQuestion.answer_type,
          correct_answer: editingQuestion.correct_answer ?? '',
          display_order: editingQuestion.display_order,
          media_file: null,
          remove_media: false,
          choices:
            editingQuestion.choices && editingQuestion.choices.length > 0
              ? editingQuestion.choices.map((c) => ({
                  label: c.label,
                  is_correct: c.is_correct,
                }))
              : emptyForm().choices,
        });
      } else {
        setQuestionForm({
          ...emptyForm(),
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

  // ─── Handlers ───────────────────────────────────────────────

  function buildFormData(isUpdate = false): FormData {
    const fd = new FormData();
    if (isUpdate) fd.append('_method', 'PUT');
    fd.append('text', questionForm.text);
    fd.append('answer_type', questionForm.answer_type);
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
      const correctChoice = choices.find((c) => c.is_correct);
      if (correctChoice) fd.append('correct_answer', correctChoice.label);
    } else {
      fd.append('correct_answer', questionForm.correct_answer);
    }

    return fd;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setQuestionLoading(true);
    setQuestionErrors({});

    try {
      if (editingQuestion) {
        const res = await api.post<{ data: PreselectionQuestion }>(
          `/admin/sessions/${sessionId}/preselection-questions/${editingQuestion.id}`,
          buildFormData(true),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const updated =
          res.data.data ?? (res.data as unknown as PreselectionQuestion);
        setQuestions((prev) =>
          prev.map((q) => (q.id === updated.id ? updated : q))
        );
        toast.success('Question mise à jour');
      } else {
        const res = await api.post<{ data: PreselectionQuestion }>(
          `/admin/sessions/${sessionId}/preselection-questions`,
          buildFormData(false),
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        const created =
          res.data.data ?? (res.data as unknown as PreselectionQuestion);
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
      toast.error("Impossible d'enregistrer la question");
    } finally {
      setQuestionLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(
        `/admin/sessions/${sessionId}/preselection-questions/${deleteTarget.id}`
      );
      setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      setDeleteOpen(false);
      setDeleteTarget(null);
      toast.success('Question supprimée');
    } catch {
      toast.error('Impossible de supprimer la question');
    } finally {
      setDeleteLoading(false);
    }
  }

  function openEdit(q: PreselectionQuestion) {
    setEditingQuestion(q);
    setQuestionOpen(true);
  }

  function openDelete(q: PreselectionQuestion) {
    setDeleteTarget(q);
    setDeleteOpen(true);
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

  // ─── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="animate-fade-in space-y-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

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
              <span>Questions de pré-sélection</span>
            </div>
            <h1 className="mt-0.5 text-2xl font-bold text-foreground">
              Questions de pré-sélection
            </h1>
          </div>
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
              Ajouter une question
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>
                {editingQuestion ? 'Modifier la question' : 'Nouvelle question'}
              </DialogTitle>
              <DialogDescription>
                Questions utilisées lors de la phase de pré-sélection des joueurs.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSave} className="flex flex-col gap-4">
              {/* Texte */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="q-text">Intitulé de la question</Label>
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
                  <p className="text-sm text-destructive">
                    {questionErrors.text[0]}
                  </p>
                )}
              </div>

              {/* Type + ordre */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <Label>Type de réponse</Label>
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
                  />
                </div>
              </div>

              {/* QCM : choix */}
              {questionForm.answer_type === 'qcm' && (
                <div className="flex flex-col gap-3">
                  <Label>
                    Choix{' '}
                    <span className="text-xs text-muted-foreground">
                      (cliquez sur le cercle pour définir la bonne réponse)
                    </span>
                  </Label>
                  {questionForm.choices.map((choice, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setChoiceCorrect(idx)}
                        className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          choice.is_correct
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/40 hover:border-primary'
                        }`}
                        title="Définir comme bonne réponse"
                      >
                        {choice.is_correct && <Check className="h-3 w-3" />}
                      </button>
                      <Input
                        value={choice.label}
                        onChange={(e) => setChoiceLabel(idx, e.target.value)}
                        placeholder={`Choix ${idx + 1}`}
                        className="flex-1"
                      />
                      {questionForm.choices.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => removeChoice(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {questionErrors.choices?.[0] && (
                    <p className="text-sm text-destructive">
                      {questionErrors.choices[0]}
                    </p>
                  )}
                  {questionForm.choices.length < 6 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="self-start"
                      onClick={addChoice}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" />
                      Ajouter un choix
                    </Button>
                  )}
                </div>
              )}

              {/* Texte libre / Nombre */}
              {questionForm.answer_type !== 'qcm' && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="q-answer">Bonne réponse</Label>
                  <Input
                    id="q-answer"
                    type={questionForm.answer_type === 'number' ? 'number' : 'text'}
                    value={questionForm.correct_answer}
                    onChange={(e) =>
                      setQuestionForm((f) => ({
                        ...f,
                        correct_answer: e.target.value,
                      }))
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

              {/* Média */}
              <div className="flex flex-col gap-2">
                <Label htmlFor="q-media">Média (optionnel)</Label>
                {editingQuestion?.media_url && !questionForm.remove_media ? (
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
                    {/\.(jpe?g|png|gif|webp|svg|avif)(\?.*)?$/i.test(editingQuestion.media_url) && (
                      <img
                        src={editingQuestion.media_url}
                        alt="aperçu"
                        className="max-h-48 w-full rounded-md object-contain bg-muted"
                      />
                    )}
                    {/\.(mp4|webm|mov|avi|mkv)(\?.*)?$/i.test(editingQuestion.media_url) && (
                      <video
                        src={editingQuestion.media_url}
                        controls
                        className="max-h-48 w-full rounded-md"
                      />
                    )}
                    {/\.(mp3|ogg|wav|aac|flac)(\?.*)?$/i.test(editingQuestion.media_url) && (
                      <audio
                        src={editingQuestion.media_url}
                        controls
                        className="w-full"
                      />
                    )}
                  </>
                ) : (
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
                  {editingQuestion ? 'Enregistrer' : 'Créer'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stat card */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <HelpCircle className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Questions</p>
              <p className="text-2xl font-bold">{questions.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Check className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">QCM</p>
              <p className="text-2xl font-bold">
                {questions.filter((q) => q.answer_type === 'qcm').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GripVertical className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Autres types</p>
              <p className="text-2xl font-bold">
                {questions.filter((q) => q.answer_type !== 'qcm').length}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Liste */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des questions</CardTitle>
          <CardDescription>
            Questions présentées aux candidats lors de la phase de pré-sélection.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Question</TableHead>
                <TableHead className="w-36">Type</TableHead>
                <TableHead className="w-32 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-10 text-center text-muted-foreground"
                  >
                    Aucune question de pré-sélection. Ajoutez-en une !
                  </TableCell>
                </TableRow>
              ) : (
                [...questions]
                  .sort((a, b) => a.display_order - b.display_order)
                  .map((q, idx) => (
                    <TableRow key={q.id}>
                      <TableCell className="font-medium text-muted-foreground">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <p className="line-clamp-2 text-sm">{q.text}</p>
                        {q.answer_type === 'qcm' && q.choices && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {q.choices.map((c) => (
                              <Badge
                                key={c.id}
                                variant={c.is_correct ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {c.is_correct && (
                                  <Check className="mr-1 h-2.5 w-2.5" />
                                )}
                                {c.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {q.answer_type !== 'qcm' && q.correct_answer && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Réponse :{' '}
                            <span className="font-medium text-foreground">
                              {q.correct_answer}
                            </span>
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ANSWER_TYPE_LABELS[q.answer_type]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(q)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => openDelete(q)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer la question</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette question ? Cette action
              est irréversible.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm">
              &laquo; {deleteTarget.text} &raquo;
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="animate-spin" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
