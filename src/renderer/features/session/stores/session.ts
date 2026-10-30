import { create } from 'zustand'
import { type Session } from '@shared/types/index.js'

export interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null

  setActiveSession: (sessionId: string) => void
  updateSession: (sessionId: string, patch: Partial<Session>) => void
  updateCurrentPath: (sessionId: string, path: string) => void
  setOperating: (sessionId: string, operating: boolean) => void
  addSession: (session: Session) => void
  replaceSession: (connectionId: string, session: Session) => void
  removeSession: (sessionId: string) => void

  getSessionByConnectionId: (connectionId: string) => Session | undefined
  getSessionById: (sessionId: string) => Session | undefined
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  getSessionByConnectionId: (connectionId) => {
    return get().sessions.find((s) => s.connectionId === connectionId)
  },

  getSessionById: (sessionId) => {
    return get().sessions.find((s) => s.sessionId === sessionId)
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId })
  },

  updateSession: (sessionId, patch) => {
    set((state) => ({
      sessions: state.sessions.map((s) => (s.sessionId === sessionId ? { ...s, ...patch } : s)),
    }))
  },

  updateCurrentPath: (sessionId, path) => {
    get().updateSession(sessionId, { currentPath: path })
  },

  setOperating: (sessionId, operating) => {
    get().updateSession(sessionId, { isOperating: operating })
  },

  addSession: (session) => {
    set((state) => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.sessionId,
    }))
  },

  replaceSession: (connectionId, session) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.connectionId !== connectionId).concat(session),
      activeSessionId: session.sessionId,
    }))
  },

  removeSession: (sessionId) => {
    set((state) => ({
      sessions: state.sessions.filter((s) => s.sessionId !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    }))
  },
}))
