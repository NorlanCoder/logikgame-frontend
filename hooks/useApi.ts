'use client';

import { useState, useCallback } from 'react';
import api from '@/lib/api';
import type { AxiosError } from 'axios';
import type { ApiError } from '@/lib/types';

interface UseApiOptions {
  onSuccess?: (data: unknown) => void;
  onError?: (error: ApiError) => void;
}

/**
 * Hook générique pour les appels API avec gestion du loading et des erreurs.
 */
export function useApi<T = unknown>(options?: UseApiOptions) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const execute = useCallback(
    async (
      method: 'get' | 'post' | 'put' | 'patch' | 'delete',
      url: string,
      body?: Record<string, unknown>
    ): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const response =
          method === 'get' || method === 'delete'
            ? await api[method]<T>(url)
            : await api[method]<T>(url, body);

        setData(response.data);
        options?.onSuccess?.(response.data);
        return response.data;
      } catch (err) {
        const axiosError = err as AxiosError<ApiError>;
        const apiError: ApiError = axiosError.response?.data ?? {
          message: 'Une erreur est survenue',
        };
        setError(apiError);
        options?.onError?.(apiError);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  const get = useCallback((url: string) => execute('get', url), [execute]);
  const post = useCallback(
    (url: string, body?: Record<string, unknown>) => execute('post', url, body),
    [execute]
  );
  const put = useCallback(
    (url: string, body?: Record<string, unknown>) => execute('put', url, body),
    [execute]
  );
  const patch = useCallback(
    (url: string, body?: Record<string, unknown>) => execute('patch', url, body),
    [execute]
  );
  const del = useCallback((url: string) => execute('delete', url), [execute]);

  return { data, loading, error, get, post, put, patch, del };
}
