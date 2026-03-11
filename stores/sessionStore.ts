import { create } from 'zustand';
import type { Session, SessionRound } from '@/lib/types';

interface SessionState {
  sessions: Session[];
  currentSession: Session | null;
  currentRound: SessionRound | null;
  setSessions: (sessions: Session[]) => void;
  setCurrentSession: (session: Session | null) => void;
  setCurrentRound: (round: SessionRound | null) => void;
  updateSession: (session: Partial<Session> & { id: number }) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  currentSession: null,
  currentRound: null,

  setSessions: (sessions) => set({ sessions }),

  setCurrentSession: (session) => set({ currentSession: session }),

  setCurrentRound: (round) => set({ currentRound: round }),

  updateSession: (partial) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === partial.id ? { ...s, ...partial } : s
      ),
      currentSession:
        state.currentSession?.id === partial.id
          ? { ...state.currentSession, ...partial }
          : state.currentSession,
    })),
}));
