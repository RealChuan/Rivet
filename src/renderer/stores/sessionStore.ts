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
  password?: string
  privateKey?: string
  authMethod?: 'password' | 'privateKey'
}

interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  addSession: (
    config: Omit<ConnectionConfig, 'id' | 'credentialId'>,
    password?: string,
    privateKey?: string
  ) => Promise<string>
  updateSession: (
    sessionId: string,
    config: Omit<ConnectionConfig, 'id' | 'credentialId'>,
    password?: string,
    privateKey?: string
  ) => Promise<void>
  removeSession: (id: string) => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  updateCurrentPath: (sessionId: string, path: string) => void
  setFiles: (sessionId: string, files: FileInfo[]) => void
  setLoading: (sessionId: string, loading: boolean) => void
  setError: (sessionId: string, error: string | null) => void
  refreshCurrentDirectory: (sessionId: string) => Promise<void>
  reconnectSession: (session: Session, password?: string, privateKey?: string) => Promise<void>
}

// 安全地处理文件列表数据
const sanitizeFiles = (files: any): FileInfo[] => {
  if (!files || !Array.isArray(files)) {
    return []
  }
  return files
    .filter((file): file is FileInfo => {
      if (!file || typeof file !== 'object') return false
      return (
        typeof file.name === 'string' &&
        (file.type === 'file' || file.type === 'directory') &&
        typeof file.size === 'number' &&
        typeof file.modifyTime === 'number' &&
        typeof file.absolutePath === 'string'
      )
    })
    .map(file => ({
      name: String(file.name),
      type: file.type === 'directory' ? 'directory' : 'file',
      size: Number(file.size || 0),
      modifyTime: Number(file.modifyTime || 0),
      permissions: typeof file.permissions === 'string' ? file.permissions : undefined,
      owner: typeof file.owner === 'string' ? file.owner : undefined,
      absolutePath: String(file.absolutePath),
    }))
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
      isLoading: true,
      error: null,
      password,
      privateKey,
      authMethod: password ? 'password' : 'privateKey',
    }

    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: sessionId,
    }))

    await new Promise(resolve => setTimeout(resolve, 100))
    await get().refreshCurrentDirectory(sessionId)

    return sessionId
  },

  updateSession: async (sessionId, config, password, privateKey) => {
    const session = get().sessions.find(s => s.id === sessionId)
    if (!session) return

    const wasConnected = session.isConnected
    if (wasConnected) {
      await window.electronAPI.disconnect(sessionId)
    }

    const usePassword = password ?? session.password
    const usePrivateKey = privateKey ?? session.privateKey

    let newSessionId = sessionId
    let isConnected = false

    if (wasConnected || usePassword || usePrivateKey) {
      try {
        newSessionId = await window.electronAPI.connect({
          ...config,
          password: usePassword,
          privateKey: usePrivateKey,
        })
        isConnected = true
      } catch (error) {
        isConnected = false
      }
    }

    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === sessionId
          ? {
              ...s,
              id: newSessionId,
              config: {
                ...config,
                id: newSessionId,
                credentialId: newSessionId,
              } as ConnectionConfig,
              password: usePassword,
              privateKey: usePrivateKey,
              authMethod: usePassword ? 'password' : 'privateKey',
              isConnected,
              currentPath: isConnected ? '/' : s.currentPath,
              files: isConnected ? [] : s.files,
              error: isConnected ? null : s.error,
              isLoading: isConnected,
            }
          : s
      ),
      activeSessionId: isConnected ? newSessionId : state.activeSessionId,
    }))

    if (isConnected) {
      await new Promise(resolve => setTimeout(resolve, 100))
      await get().refreshCurrentDirectory(newSessionId)
    }
  },

  removeSession: async id => {
    const session = get().sessions.find(s => s.id === id)
    if (session?.isConnected) {
      await window.electronAPI.disconnect(id)
    }

    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === id ? { ...s, isConnected: false, files: [], error: null } : s
      ),
    }))
  },

  deleteSession: async id => {
    await window.electronAPI.deleteConnection(id)
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
    const safeFiles = sanitizeFiles(files)
    set(state => ({
      sessions: state.sessions.map(s => (s.id === sessionId ? { ...s, files: safeFiles } : s)),
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
    let session = get().sessions.find(s => s.id === sessionId)
    if (!session) return

    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === sessionId ? { ...s, isLoading: true, error: null } : s
      ),
    }))

    try {
      session = get().sessions.find(s => s.id === sessionId)
      if (!session) return

      const result = await window.electronAPI.list(sessionId, session.currentPath)
      const safeFiles = sanitizeFiles(result)
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, files: safeFiles, isLoading: false } : s
        ),
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to list directory'
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId ? { ...s, error: errorMsg, isLoading: false, files: [] } : s
        ),
      }))
    }
  },

  reconnectSession: async (session, password, privateKey) => {
    try {
      const usePassword = password ?? session.password
      const usePrivateKey = privateKey ?? session.privateKey

      const sessionId = await window.electronAPI.connect({
        host: session.config.host,
        port: session.config.port,
        username: session.config.username,
        name: session.config.name,
        protocol: session.config.protocol,
        password: usePassword,
        privateKey: usePrivateKey,
      })

      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === session.id
            ? {
                ...s,
                id: sessionId,
                isConnected: true,
                error: null,
                password: usePassword,
                privateKey: usePrivateKey,
                authMethod: usePassword ? 'password' : 'privateKey',
                currentPath: '/',
              }
            : s
        ),
        activeSessionId: sessionId,
      }))

      await get().refreshCurrentDirectory(sessionId)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to reconnect'
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === session.id ? { ...s, error: errorMsg, isConnected: false } : s
        ),
      }))
      throw error
    }
  },
}))

export default useSessionStore
