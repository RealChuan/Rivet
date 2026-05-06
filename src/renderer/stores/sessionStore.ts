import { create } from 'zustand'
import { ConnectionConfig, FileInfo } from '@shared/types'

interface Session {
  id: string
  config: ConnectionConfig
  currentPath: string
  files: FileInfo[]
  isConnected: boolean
  isLoading: boolean
  error: string | null
}

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  addSession: (
    config: Omit<ConnectionConfig, 'id' | 'credentialId'>,
    password?: string,
    privateKey?: string
  ) => Promise<string>
  removeSession: (id: string) => void
  setActiveSession: (id: string) => void
  updateCurrentPath: (sessionId: string, path: string) => void
  setFiles: (sessionId: string, files: FileInfo[]) => void
  setLoading: (sessionId: string, loading: boolean) => void
  setError: (sessionId: string, error: string | null) => void
  refreshCurrentDirectory: (sessionId: string) => Promise<void>
  reconnectSession: (session: Session, password?: string, privateKey?: string) => Promise<void>
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,

  addSession: async (config, password, privateKey) => {
    const sessionId = await window.electronAPI.connect({
      ...config,
      password,
      privateKey,
    })

    const session: Session = {
      id: sessionId,
      config: {
        ...config,
        id: sessionId,
        credentialId: sessionId,
      } as ConnectionConfig,
      currentPath: '/',
      files: [],
      isConnected: true,
      isLoading: false,
      error: null,
    }

    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: sessionId,
    }))

    await get().refreshCurrentDirectory(sessionId)

    return sessionId
  },

  removeSession: async id => {
    const session = get().sessions.find(s => s.id === id)
    if (session?.isConnected) {
      await window.electronAPI.disconnect(id)
    }

    set(state => {
      const newSessions = state.sessions.filter(s => s.id !== id)
      let newActiveId = state.activeSessionId
      if (state.activeSessionId === id) {
        newActiveId = newSessions.length > 0 ? newSessions[0].id : null
      }
      return { sessions: newSessions, activeSessionId: newActiveId }
    })
  },

  setActiveSession: id => {
    set({ activeSessionId: id })
  },

  updateCurrentPath: (sessionId, path) => {
    set(state => ({
      sessions: state.sessions.map(s => (s.id === sessionId ? { ...s, currentPath: path } : s)),
    }))
  },

  setFiles: (sessionId, files) => {
    set(state => ({
      sessions: state.sessions.map(s => (s.id === sessionId ? { ...s, files } : s)),
    }))
  },

  setLoading: (sessionId, loading) => {
    set(state => ({
      sessions: state.sessions.map(s => (s.id === sessionId ? { ...s, isLoading: loading } : s)),
    }))
  },

  setError: (sessionId, error) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === sessionId ? { ...s, error, isConnected: error ? false : s.isConnected } : s
      ),
    }))
  },

  refreshCurrentDirectory: async sessionId => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return

    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === sessionId ? { ...s, isLoading: true, error: null } : s
      ),
    }))

    try {
      const files = await window.electronAPI.listDirectory(sessionId, session.currentPath)
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, files, isLoading: false } : s
        ),
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to list directory'
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, error: errorMsg, isLoading: false } : s
        ),
      }))
    }
  },

  reconnectSession: async (session, password, privateKey) => {
    try {
      const sessionId = await window.electronAPI.connect({
        host: session.config.host,
        port: session.config.port,
        username: session.config.username,
        name: session.config.name,
        protocol: session.config.protocol,
        password,
        privateKey,
      })

      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === session.id ? { ...s, id: sessionId, isConnected: true, error: null } : s
        ),
      }))

      await get().refreshCurrentDirectory(sessionId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to reconnect'
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === session.id ? { ...s, error: errorMsg, isConnected: false } : s
        ),
      }))
    }
  },
}))

export default useSessionStore
