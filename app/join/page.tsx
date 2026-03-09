'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';

function JoinRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    router.replace(token ? `/player/join?token=${token}` : '/player/join');
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      }
    >
      <JoinRedirect />
    </Suspense>
  );
}
