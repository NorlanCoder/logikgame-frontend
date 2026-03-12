'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Server, Radio, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';
import { useEcho } from '@/hooks/useEcho';

type CheckState = 'idle' | 'checking' | 'ok' | 'error';
type WsStatus = 'not_initialized' | 'connecting' | 'connected' | 'unavailable' | 'failed';

function StatusBadge({ state, okText, errorText }: { state: CheckState; okText: string; errorText: string }) {
  if (state === 'checking' || state === 'idle') {
    return <span className="rounded-full bg-slate-700/60 px-3 py-1 text-xs font-semibold text-slate-200">Verification...</span>;
  }

  if (state === 'ok') {
    return <span className="rounded-full bg-emerald-600/25 px-3 py-1 text-xs font-semibold text-emerald-300">{okText}</span>;
  }

  return <span className="rounded-full bg-red-600/25 px-3 py-1 text-xs font-semibold text-red-300">{errorText}</span>;
}

export default function RealtimeDiagPage() {
  const echo = useEcho();
  const [apiState, setApiState] = useState<CheckState>('idle');
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [apiError, setApiError] = useState<string>('');

  const [wsStatus, setWsStatus] = useState<WsStatus>('not_initialized');
  const [wsError, setWsError] = useState<string>('');

  const [lastCheckedAt, setLastCheckedAt] = useState<string>('');

  const wsCheckState = useMemo<CheckState>(() => {
    if (wsStatus === 'connecting' || wsStatus === 'not_initialized') return 'checking';
    if (wsStatus === 'connected') return 'ok';
    return 'error';
  }, [wsStatus]);

  const runApiCheck = useCallback(async () => {
    setApiState('checking');
    setApiError('');

    const startedAt = performance.now();
    try {
      await api.get('/ping');
      setApiLatency(Math.round(performance.now() - startedAt));
      setApiState('ok');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Impossible de joindre /api/ping';
      setApiError(message);
      setApiState('error');
    }
  }, []);

  const runChecks = useCallback(async () => {
    await runApiCheck();
    setLastCheckedAt(new Date().toLocaleTimeString('fr-FR'));
  }, [runApiCheck]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void runChecks();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [runChecks]);

  useEffect(() => {
    if (!echo) return;

    const connector = (echo as unknown as { connector?: { pusher?: { connection?: { state?: string; bind?: (event: string, callback: (arg?: unknown) => void) => void; unbind?: (event: string, callback: (arg?: unknown) => void) => void } } } }).connector;
    const connection = connector?.pusher?.connection;

    const deferWsState = (status: WsStatus, error = '') => {
      window.setTimeout(() => {
        setWsStatus(status);
        setWsError(error);
      }, 0);
    };

    if (!connection) {
      deferWsState('unavailable', 'Connexion WebSocket non disponible (configuration Reverb).');
      return;
    }

    const currentState = connection.state;
    if (currentState === 'connected') {
      deferWsState('connected');
    } else if (currentState === 'connecting' || currentState === 'initialized') {
      deferWsState('connecting');
    } else {
      deferWsState('failed', 'Etat de connexion WebSocket invalide.');
    }

    const handleConnected = () => {
      setWsStatus('connected');
      setWsError('');
    };

    const handleError = (event?: unknown) => {
      setWsStatus('failed');
      const fallback = 'Echec de connexion WebSocket.';
      if (event && typeof event === 'object' && 'error' in (event as Record<string, unknown>)) {
        const detail = (event as { error?: { message?: string } }).error?.message;
        setWsError(detail || fallback);
        return;
      }
      setWsError(fallback);
    };

    const handleUnavailable = () => {
      setWsStatus('unavailable');
      setWsError('Serveur WebSocket indisponible.');
    };

    connection.bind?.('connected', handleConnected);
    connection.bind?.('error', handleError);
    connection.bind?.('unavailable', handleUnavailable);

    return () => {
      connection.unbind?.('connected', handleConnected);
      connection.unbind?.('error', handleError);
      connection.unbind?.('unavailable', handleUnavailable);
    };
  }, [echo]);

  const overallOk = apiState === 'ok' && wsStatus === 'connected';

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-4 py-10 text-slate-100 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-6 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">Diagnostic production</p>
          <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Verification mode temps reel sans session</h1>
          <p className="mt-3 max-w-2xl text-sm text-slate-300">
            Cette page permet de verifier rapidement que l&apos;API et la connexion WebSocket fonctionnent en prod, sans creer de session de jeu.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={runChecks}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              <RefreshCw className="h-4 w-4" />
              Relancer les tests
            </button>
            {lastCheckedAt && <span className="text-xs text-slate-400">Dernier test: {lastCheckedAt}</span>}
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2">
          <article className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Server className="h-5 w-5 text-cyan-300" /> API Backend
                </h2>
                <p className="mt-1 text-xs text-slate-400">Test de l&apos;endpoint public `/api/ping`</p>
              </div>
              <StatusBadge state={apiState} okText="API OK" errorText="API KO" />
            </div>

            {apiState === 'ok' && (
              <p className="text-sm text-emerald-300">Reponse recue en {apiLatency ?? '-'} ms.</p>
            )}
            {apiState === 'error' && (
              <p className="text-sm text-red-300">{apiError || 'Erreur API inconnue.'}</p>
            )}
          </article>

          <article className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Radio className="h-5 w-5 text-cyan-300" /> WebSocket Reverb
                </h2>
                <p className="mt-1 text-xs text-slate-400">Verification de la connexion Echo/Pusher</p>
              </div>
              <StatusBadge state={wsCheckState} okText="WS connecte" errorText="WS KO" />
            </div>

            <p className="text-sm text-slate-300">Etat: <span className="font-medium">{wsStatus}</span></p>
            {wsError && <p className="mt-2 text-sm text-red-300">{wsError}</p>}
          </article>
        </section>

        <section className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Resultat global</h3>
          <div className="mt-3 flex items-center gap-3">
            {overallOk ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <p className="text-sm text-emerald-300">Le mode temps reel semble operationnel en production.</p>
              </>
            ) : apiState === 'checking' || wsCheckState === 'checking' ? (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <p className="text-sm text-amber-300">Verification en cours...</p>
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-400" />
                <p className="text-sm text-red-300">Un ou plusieurs checks ont echoue. Verifie les variables d&apos;environnement et les services backend/Reverb.</p>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
