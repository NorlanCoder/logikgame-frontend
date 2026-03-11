'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Label } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import type { Admin } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.post<{ token: string; admin: Admin }>(
        '/admin/login',
        { email, password }
      );
      setAuth(res.data.admin, res.data.token);
      router.replace('/admin/sessions');
    } catch {
      setError('Identifiants invalides');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-950 via-gray-900 to-black">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-gray-900">
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900 dark:text-white">
          LOGIK GAME
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Panneau d&apos;administration
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@logikgame.com"
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading && <Loader2 className="animate-spin" />}
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
