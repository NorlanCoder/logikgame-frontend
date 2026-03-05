'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card, CardContent, CardHeader, CardTitle, Label, Textarea } from '@/components/ui';
import api from '@/lib/api';
import type { ApiError } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CreateSessionPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState({
    name: '',
    scheduled_at: '',
    max_players: 100,
    description: '',
  });

  function updateField(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      await api.post('/admin/sessions', form);
      toast.success('Session créée avec succès');
      router.push('/admin/sessions');
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: ApiError } }).response?.data;
      if (apiErr?.errors) {
        setErrors(apiErr.errors);
      }
      toast.error('Impossible de créer la session');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in mx-auto max-w-2xl">
      <h1 className="mb-8 text-2xl font-bold text-foreground">
        Créer une session
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>Nouvelle session</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Nom de la session</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="LOGIK S01E01"
                required
              />
              {errors.name?.[0] && (
                <p className="text-sm text-destructive">{errors.name[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="scheduled_at">Date et heure</Label>
              <Input
                id="scheduled_at"
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => updateField('scheduled_at', e.target.value)}
                required
              />
              {errors.scheduled_at?.[0] && (
                <p className="text-sm text-destructive">{errors.scheduled_at[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="max_players">Nombre max de joueurs</Label>
              <Input
                id="max_players"
                type="number"
                min={2}
                max={1000}
                value={form.max_players}
                onChange={(e) => updateField('max_players', Number(e.target.value))}
                required
              />
              {errors.max_players?.[0] && (
                <p className="text-sm text-destructive">{errors.max_players[0]}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="description">Description (optionnel)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={3}
                placeholder="Description publique de la session..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="animate-spin" />}
                Créer la session
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => router.back()}
              >
                Annuler
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
