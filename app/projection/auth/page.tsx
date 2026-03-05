'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@/components/ui';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';

export default function ProjectionAuthPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/projection/authenticate', {
        access_code: code.toUpperCase(),
      });
      router.push(`/projection/${code.toUpperCase()}`);
    } catch {
      setError('Code d\'accès invalide');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm rounded-2xl bg-card p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-card-foreground">
          Écran de projection
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Entrez le code d&apos;accès à 6 caractères
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="code" className="sr-only">Code d&apos;accès</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
              placeholder="ABC123"
              maxLength={6}
              className="text-center text-2xl tracking-widest"
              required
            />
          </div>

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="animate-spin" />}
            Accéder
          </Button>
        </form>
      </div>
    </div>
  );
}
