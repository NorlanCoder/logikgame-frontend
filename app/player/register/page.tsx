'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, Input, Label } from '@/components/ui';
import api from '@/lib/api';
import type { ApiError } from '@/lib/types';
import { Loader2 } from 'lucide-react';

function RegisterForm() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState({
    session_id: searchParams.get('session_id') ?? '',
    full_name: '',
    email: '',
    phone: '',
    pseudo: '',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await api.post('/player/register', {
        ...form,
        session_id: Number(form.session_id),
      });
      setSuccess(true);
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: ApiError } }).response?.data;
      if (apiErr?.errors) {
        setErrors(apiErr.errors);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="text-center">
          <div className="mb-4 text-5xl">✅</div>
          <h2 className="text-2xl font-bold">Inscription réussie !</h2>
          <p className="mt-2 text-muted-foreground">
            Vérifiez votre e-mail pour la confirmation et les prochaines étapes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-card-foreground">
          Rejoindre LOGIK GAME
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Inscrivez-vous pour participer à une session
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="session_id">Code de session</Label>
            <Input
              id="session_id"
              value={form.session_id}
              onChange={(e) => updateField('session_id', e.target.value)}
              placeholder="ID de la session"
              required
            />
            {errors.session_id?.[0] && (
              <p className="text-sm text-destructive">{errors.session_id[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="full_name">Nom complet</Label>
            <Input
              id="full_name"
              value={form.full_name}
              onChange={(e) => updateField('full_name', e.target.value)}
              placeholder="Jean Dupont"
              required
            />
            {errors.full_name?.[0] && (
              <p className="text-sm text-destructive">{errors.full_name[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="jean@example.com"
              required
            />
            {errors.email?.[0] && (
              <p className="text-sm text-destructive">{errors.email[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+33612345678"
              required
            />
            {errors.phone?.[0] && (
              <p className="text-sm text-destructive">{errors.phone[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="pseudo">Pseudo (nom de jeu)</Label>
            <Input
              id="pseudo"
              value={form.pseudo}
              onChange={(e) => updateField('pseudo', e.target.value)}
              placeholder="MonPseudo123"
              required
            />
            {errors.pseudo?.[0] && (
              <p className="text-sm text-destructive">{errors.pseudo[0]}</p>
            )}
          </div>

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading && <Loader2 className="animate-spin" />}
            S&apos;inscrire
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function PlayerRegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  );
}
