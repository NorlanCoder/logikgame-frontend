'use client';

import { Suspense, use, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import api from '@/lib/api';
import type { PreselectionQuestion } from '@/lib/types';
import { Button, Input } from '@/components/ui';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  PlayCircle,
  XCircle,
} from 'lucide-react';

// ─── Types locaux ────────────────────────────────────────────

interface VerifyResult {
  player: { full_name: string; pseudo: string; email: string };
  session: { id: number; name: string; scheduled_at: string };
  registration: { id: number; status: string };
  has_completed: boolean;
}

interface AnswerEntry {
  preselection_question_id: number;
  selected_choice_id?: number;
  answer_value?: string;
  response_time_ms: number;
}

interface SubmitResult {
  message: string;
  correct_answers: number;
  total_questions: number;
  total_response_time_ms: number;
}

// ─── Quiz core ───────────────────────────────────────────────

function PreselectionQuiz({ sessionId }: { sessionId: string }) {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  // Chargement : vérification du token + questions
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PreselectionQuestion[]>([]);
  const [verifyData, setVerifyData] = useState<VerifyResult | null>(null);

  useEffect(() => {
    if (!token) {
      setLoadError("Lien invalide : token d'accès manquant.");
      setLoading(false);
      return;
    }
    Promise.all([
      api.get('/player/preselection/verify', { params: { token } }),
      api.get(`/player/sessions/${sessionId}/preselection/questions`),
    ])
      .then(([verifyRes, questionsRes]) => {
        setVerifyData(verifyRes.data);
        if (verifyRes.data.has_completed) {
          setAlreadySubmitted(true);
        } else {
          setQuestions(questionsRes.data.data ?? questionsRes.data);
        }
      })
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } }).response?.status;
        if (status === 404) {
          setLoadError('Token invalide ou expiré. Vérifiez votre lien d\'accès.');
        } else {
          setLoadError('Impossible de charger le quiz. Vérifiez votre lien.');
        }
      })
      .finally(() => setLoading(false));
  }, [sessionId, token]);

  // État du quiz
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [collectedAnswers, setCollectedAnswers] = useState<AnswerEntry[]>([]);
  const [selectedChoiceId, setSelectedChoiceId] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState('');
  const questionStartRef = useRef<number>(Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);

  // Résultat
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  // Refs pour l'auto-avance (évite les stale closures)
  const handleNextRef = useRef<() => Promise<void>>(async () => {});
  const autoAdvancedRef = useRef(false);

  // Timer — rafraîchi toutes les 100ms, uniquement quand le quiz est démarré
  useEffect(() => {
    if (!started) return;
    const id = setInterval(
      () => setElapsedMs(Date.now() - questionStartRef.current),
      100
    );
    return () => clearInterval(id);
  }, [started]);

  // Reset des saisies à chaque changement de question
  useEffect(() => {
    setSelectedChoiceId(null);
    setAnswerText('');
    questionStartRef.current = Date.now();
    setElapsedMs(0);
    autoAdvancedRef.current = false;
  }, [currentIndex]);

  function canAdvance() {
    const q = questions[currentIndex];
    if (!q) return false;
    if (q.answer_type === 'qcm') return selectedChoiceId !== null;
    return answerText.trim().length > 0;
  }

  async function handleNext() {
    const q = questions[currentIndex];
    const responseTimeMs = Math.min(
      Date.now() - questionStartRef.current,
      q.duration * 1000,
    );
    const answer: AnswerEntry = {
      preselection_question_id: q.id,
      response_time_ms: responseTimeMs,
    };

    if (q.answer_type === 'qcm') {
      if (selectedChoiceId !== null) {
        answer.selected_choice_id = selectedChoiceId;
      }
    } else {
      answer.answer_value = answerText.trim();
    }

    const allAnswers = [...collectedAnswers, answer];
    setCollectedAnswers(allAnswers);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((i) => i + 1);
      return;
    }

    // Dernière question → soumission
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.post('/player/preselection/submit', {
        registration_token: token,
        answers: allAnswers,
      });
      setResult(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      if (status === 422) {
        // Déjà soumis : on affiche un écran dédié
        setAlreadySubmitted(true);
      } else if (status === 404) {
        setSubmitError('Token invalide. Vérifiez que vous utilisez le bon lien reçu par e-mail.');
      } else {
        setSubmitError(msg ?? 'Une erreur est survenue lors de la soumission.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Met à jour handleNextRef à chaque render pour éviter les stale closures
  useEffect(() => {
    handleNextRef.current = handleNext;
  });

  // Auto-avance quand le temps est écoulé
  useEffect(() => {
    if (!started) return;
    const q = questions[currentIndex];
    if (!q || autoAdvancedRef.current) return;
    if (elapsedMs >= q.duration * 1000) {
      autoAdvancedRef.current = true;
      void handleNextRef.current();
    }
  }, [elapsedMs, started, currentIndex, questions]);

  // ─── Rendus conditionnels ─────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <XCircle className="h-16 w-16 text-red-500" />
        <h2 className="text-2xl font-bold">{loadError}</h2>
        <Link href="/" className="text-blue-400 underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-400" />
        <h2 className="text-2xl font-bold">Réponses déjà soumises</h2>
        {verifyData && (
          <p className="text-sm text-gray-500">
            {verifyData.player.full_name} &mdash; {verifyData.session.name}
          </p>
        )}
        <p className="mt-2 text-gray-400">
          Vous avez déjà participé au quiz de présélection. Attendez les
          résultats de sélection par e-mail.
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <XCircle className="h-16 w-16 text-yellow-400" />
        <h2 className="text-2xl font-bold">Aucune question disponible</h2>
        <p className="mt-2 text-gray-400">
          Le quiz n&apos;a pas encore été configuré. Revenez plus tard.
        </p>
      </div>
    );
  }

  // ─── Résultat final ───────────────────────────────────────

  if (result) {
    const totalSec = Math.round(result.total_response_time_ms / 1000);
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md text-center">
          <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-green-600/20">
            <CheckCircle2 className="h-10 w-10 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold">Quiz terminé !</h2>
          <p className="mt-2 text-gray-400">{result.message}</p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="rounded-xl border border-green-800/50 bg-green-900/20 p-4">
              <p className="text-3xl font-bold text-green-400">
                {result.correct_answers}/{result.total_questions}
              </p>
              <p className="mt-1 text-sm text-gray-400">Bonnes réponses</p>
            </div>
            <div className="rounded-xl border border-blue-800/50 bg-blue-900/20 p-4">
              <p className="text-3xl font-bold text-blue-400">{totalSec}s</p>
              <p className="mt-1 text-sm text-gray-400">Temps total</p>
            </div>
          </div>
          <div className="mt-6 rounded-xl border border-gray-700 bg-gray-800/50 p-4 text-sm text-gray-400">
            Vos réponses ont été enregistrées. Vous recevrez les résultats de
            la sélection par e-mail.
          </div>
        </div>
      </div>
    );
  }

  // ─── Écran de démarrage ──────────────────────────────────

  if (!started) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900/60 p-8 text-center">
          <div className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-blue-600/20 text-blue-400">
            <PlayCircle className="h-10 w-10" />
          </div>
          {verifyData && (
            <p className="mb-2 text-sm text-gray-400">
              Bonjour,{' '}
              <span className="font-semibold text-white">
                {verifyData.player.full_name}
              </span>
            </p>
          )}
          <h1 className="text-2xl font-bold">Quiz de présélection</h1>
          {verifyData && (
            <p className="mt-1 text-sm text-blue-400">{verifyData.session.name}</p>
          )}
          <p className="mt-3 text-gray-400">
            Ce quiz comporte{' '}
            <span className="font-semibold text-white">{questions.length} question{questions.length > 1 ? 's' : ''}</span>.
            Le chronomètre démarre à la première question.
          </p>
          <ul className="mt-6 space-y-2 rounded-xl border border-gray-700 bg-gray-800/50 p-4 text-left text-sm text-gray-400">
            <li>— Le temps de réponse est pris en compte dans le classement.</li>
            <li>— Vous ne pouvez soumettre qu&apos;une seule fois.</li>
            <li>— Répondez à chaque question dans l&apos;ordre.</li>
          </ul>
          <Button
            onClick={() => {
              questionStartRef.current = Date.now();
              setStarted(true);
            }}
            className="mt-6 w-full text-base"
          >
            <PlayCircle className="mr-2 h-5 w-5" />
            Commencer le quiz
          </Button>
        </div>
      </div>
    );
  }

  // ─── Quiz en cours ────────────────────────────────────────

  const q = questions[currentIndex];
  const isLast = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const remainingMs = Math.max(0, q.duration * 1000 - elapsedMs);
  const remainingSeconds = Math.ceil(remainingMs / 1000);
  const remainingPct = (remainingMs / (q.duration * 1000)) * 100;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-gray-400">
            Question{' '}
            <span className="font-semibold text-white">{currentIndex + 1}</span>{' '}
            / {questions.length}
          </span>
          <span className={`flex items-center gap-1 font-semibold tabular-nums ${
            remainingPct <= 25
              ? 'text-red-400'
              : remainingPct <= 50
              ? 'text-yellow-400'
              : 'text-gray-300'
          }`}>
            <Clock className="h-4 w-4" />
            {remainingSeconds}s
          </span>
        </div>

        {/* Barre de compte à rebours */}
        <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              remainingPct <= 25
                ? 'bg-red-500'
                : remainingPct <= 50
                ? 'bg-yellow-500'
                : 'bg-green-500'
            }`}
            style={{ width: `${remainingPct}%` }}
          />
        </div>

        {/* Progression globale des questions */}
        <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Carte question */}
        <div className="rounded-2xl border border-gray-800 bg-gray-900/60 p-6">
          {/* Média */}
          {q.media_url && q.media_type === 'image' && (
            <div className="mb-5 overflow-hidden rounded-xl">
              <Image
                src={q.media_url}
                alt="Illustration de la question"
                width={600}
                height={300}
                className="w-full object-cover"
              />
            </div>
          )}
          {q.media_url && q.media_type === 'audio' && (
            <div className="mb-5">
              <audio controls src={q.media_url} className="w-full rounded-xl" />
            </div>
          )}

          {/* Texte de la question */}
          <h2 className="mb-6 text-lg font-semibold leading-relaxed">
            {q.text}
          </h2>

          {/* Choix QCM */}
          {q.answer_type === 'qcm' && q.choices && (
            <div className="flex flex-col gap-3">
              {[...q.choices]
                .sort((a, b) => a.display_order - b.display_order)
                .map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => setSelectedChoiceId(choice.id)}
                    className={`rounded-xl border px-5 py-4 text-left text-sm transition-all ${
                      selectedChoiceId === choice.id
                        ? 'border-blue-500 bg-blue-600/20 text-white ring-1 ring-blue-500/50'
                        : 'border-gray-700 bg-gray-800/40 text-gray-300 hover:border-gray-500 hover:bg-gray-800'
                    }`}
                  >
                    {choice.label}
                  </button>
                ))}
            </div>
          )}

          {/* Réponse texte */}
          {q.answer_type === 'text' && (
            <Input
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Votre réponse..."
              className="mt-2"
              onKeyDown={(e) =>
                e.key === 'Enter' && canAdvance() && handleNext()
              }
              autoFocus
            />
          )}

          {/* Réponse numérique */}
          {q.answer_type === 'number' && (
            <Input
              type="number"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Votre réponse numérique..."
              className="mt-2"
              onKeyDown={(e) =>
                e.key === 'Enter' && canAdvance() && handleNext()
              }
              autoFocus
            />
          )}

          {submitError && (
            <p className="mt-4 text-sm text-red-400">{submitError}</p>
          )}

          {/* Bouton suivant / soumettre */}
          <Button
            onClick={handleNext}
            disabled={!canAdvance() || submitting}
            className="mt-6 w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Envoi en cours…
              </>
            ) : isLast ? (
              'Soumettre mes réponses'
            ) : (
              <>
                Question suivante
                <ChevronRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Page (wrapping Suspense pour useSearchParams) ────────────

export default function PreselectionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
          </div>
        }
      >
        <PreselectionQuiz sessionId={sessionId} />
      </Suspense>
    </div>
  );
}
