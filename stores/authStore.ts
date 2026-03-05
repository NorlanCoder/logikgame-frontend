import { create } from 'zustand';
import type { Admin } from '@/lib/types';
import api from '@/lib/api';

interface AuthState {
  admin: Admin | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (admin: Admin, token: string) => void;
  logout: () => void;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  admin: null,
  token: null,
  isAuthenticated: false,
  isHydrated: false,

  setAuth: (admin, token) => {
    localStorage.setItem('admin_token', token);
    localStorage.setItem('admin_data', JSON.stringify(admin));
    set({ admin, token, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_data');
    set({ admin: null, token: null, isAuthenticated: false });
  },

  hydrate: async () => {
    if (get().isHydrated) return;

    const token = localStorage.getItem('admin_token');
    if (!token) {
      set({ isHydrated: true });
      return;
    }

    // Restaurer immédiatement depuis le cache local
    const cached = localStorage.getItem('admin_data');
    if (cached) {
      try {
        const admin = JSON.parse(cached) as Admin;
        set({ admin, token, isAuthenticated: true });
      } catch {
        // données corrompues, on continue avec la vérif API
      }
    }

    // Vérifier le token auprès du serveur
    try {
      const res = await api.get<Admin>('/admin/me');
      const admin = res.data;
      localStorage.setItem('admin_data', JSON.stringify(admin));
      set({ admin, token, isAuthenticated: true, isHydrated: true });
    } catch {
      // Token expiré ou invalide
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_data');
      set({ admin: null, token: null, isAuthenticated: false, isHydrated: true });
    }
  },
}));
