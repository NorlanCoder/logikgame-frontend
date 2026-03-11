'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import type { AnswerType, RegistrationStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, Check, ChevronRight, X } from 'lucide-react';

// ─── Types locaux ────────────────────────────────────────

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

// ─── Types locaux ─────────────────────────────────────────────

interface PlayerAnswer {
  question_id: number;
  question_text: string;
  answer_type: AnswerType;
  selected_choice?: string;
  answer_value?: string;
  correct_answer: string;
  is_correct: boolean;
  response_time_ms: number;
}

interface RegistrationDetail {
  registration_id: number;
  status: RegistrationStatus;
  player: {
    id: number;
    full_name: string;
    pseudo: string;
    email: string;
    phone: string;
  };
  preselection_result: {
    correct_answers_count: number;
    total_questions: number;
    score_percent: number;
    total_response_time_ms: number;
  } | null;
  answers: PlayerAnswer[];
}

function fmtTime(ms: number) {
  const s = (ms / 1000).toFixed(2);
  return `${s}s`;
}

const ANSWER_TYPE_LABELS: Record<AnswerType, string> = {
  qcm: 'QCM',
  number: 'Nombre',
  text: 'Texte',
};

// ─── Page ─────────────────────────────────────────────────────

export default function PreselectionRegistrationDetailPage({
  params,
}: {
  params: Promise<{ id: string; registrationId: string }>;
}) {
  const { id, registrationId } = use(params);

  const [data, setData] = useState<RegistrationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get(
        `/admin/sessions/${id}/preselection/registrations/${registrationId}`
      )
      .then((res) => setData(res.data))
      .catch(() => setError('Impossible de charger le détail de cet inscrit.'))
      .finally(() => setLoading(false));
  }, [id, registrationId]);

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
        <Link
          href={`/admin/sessions/${id}/preselection/registrations`}
          className="hover:text-foreground"
        >
          Pré-sélection
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Inscrit #{registrationId}</span>
      </div>

      {/* Back */}
      <Link
        href={`/admin/sessions/${id}/preselection/registrations`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour au classement
      </Link>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : data ? (
        <>
          {/* Fiche joueur */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{data.player.full_name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    @{data.player.pseudo} · {data.player.email} · {data.player.phone}
                  </p>
                </div>
                <RegStatusBadge status={data.status} />
              </div>
            </CardHeader>
            {data.preselection_result && (
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="rounded-xl border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">
                      {data.preselection_result.correct_answers_count}/
                      {data.preselection_result.total_questions}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Bonnes réponses</p>
                  </div>
                  <div className="rounded-xl border bg-card p-4 text-center">
                    <p className="text-2xl font-bold text-blue-400">
                      {data.preselection_result.score_percent.toFixed(1)}%
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Score</p>
                  </div>
                  <div className="rounded-xl border bg-card p-4 text-center">
                    <p className="text-2xl font-bold">
                      {(data.preselection_result.total_response_time_ms / 1000).toFixed(1)}s
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Temps total</p>
                  </div>
                  <div className="rounded-xl border bg-card p-4 text-center">
                    <p className="text-2xl font-bold">
                      {data.answers.length}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Réponses enregistrées</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Tableau des réponses */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Réponses question par question</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.answers.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Aucune réponse enregistrée.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Réponse donnée</TableHead>
                      <TableHead>Bonne réponse</TableHead>
                      <TableHead className="w-14 text-center">Résultat</TableHead>
                      <TableHead className="text-right">Temps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.answers.map((ans, idx) => (
                      <TableRow key={ans.question_id}>
                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="max-w-xs">
                          <p className="line-clamp-2 text-sm">{ans.question_text}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ANSWER_TYPE_LABELS[ans.answer_type]}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[140px]">
                          <span className="truncate text-sm">
                            {ans.selected_choice ?? ans.answer_value ?? (
                              <span className="text-muted-foreground italic">—</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[140px]">
                          <span className="truncate text-sm text-muted-foreground">
                            {ans.correct_answer}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {ans.is_correct ? (
                            <Check className="mx-auto h-5 w-5 text-green-500" />
                          ) : (
                            <X className="mx-auto h-5 w-5 text-red-500" />
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-sm">
                          {fmtTime(ans.response_time_ms)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
