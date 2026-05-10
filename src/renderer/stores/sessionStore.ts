import { create } from 'zustand'
import { ConnectionConfig, FileInfo } from '../../shared/types.js'

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
  addSession: (config: Omit<ConnectionConfig, 'connectionId'>) => Promise<string>
  updateSession: (
    connectionId: string,
    config: Omit<ConnectionConfig, 'connectionId'>
  ) => Promise<void>
  removeSession: (id: string) => void
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  updateCurrentPath: (connectionId: string, path: string) => void
  setFiles: (connectionId: string, files: FileInfo[]) => void
  setLoading: (connectionId: string, loading: boolean) => void
  setError: (connectionId: string, error: string | null) => void
  refreshCurrentDirectory: (connectionId: string) => Promise<void>
  reconnectSession: (session: Session, password?: string) => Promise<void>
  loadSavedConnections: () => Promise<void>
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

  addSession: async config => {
    const connectionId = await window.electronAPI.protocol.connect(config)

    const fullConfig: ConnectionConfig = {
      ...config,
      connectionId,
    } as ConnectionConfig

    const session: Session = {
      id: connectionId,
      config: fullConfig,
      currentPath: '/',
      files: [],
      isConnected: true,
      isLoading: true,
      error: null,
    }

    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: connectionId,
    }))

    await new Promise(resolve => setTimeout(resolve, 100))
    await get().refreshCurrentDirectory(connectionId)

    return connectionId
  },

  updateSession: async (connectionId, config) => {
    const session = get().sessions.find(s => s.id === connectionId)
    if (!session) return

    const wasConnected = session.isConnected
    if (wasConnected) {
      await window.electronAPI.protocol.disconnect(connectionId)
    }

    const fullConfig: ConnectionConfig = {
      ...config,
      connectionId: session.config.connectionId,
    } as ConnectionConfig

    let newConnectionId = connectionId
    let isConnected = false

    if (wasConnected || config.password) {
      try {
        newConnectionId = await window.electronAPI.protocol.connect(fullConfig)
        isConnected = true
      } catch {
        isConnected = false
      }
    }

    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === connectionId
          ? {
              ...s,
              id: newConnectionId,
              config: fullConfig,
              isConnected,
              currentPath: isConnected ? '/' : s.currentPath,
              files: isConnected ? [] : s.files,
              error: isConnected ? null : s.error,
              isLoading: isConnected,
            }
          : s
      ),
      activeSessionId: isConnected ? newConnectionId : state.activeSessionId,
    }))

    if (isConnected) {
      await new Promise(resolve => setTimeout(resolve, 100))
      await get().refreshCurrentDirectory(newConnectionId)
    }
  },

  removeSession: async id => {
    const session = get().sessions.find(s => s.id === id)
    if (session?.isConnected) {
      await window.electronAPI.protocol.disconnect(id)
    }

    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === id ? { ...s, isConnected: false, files: [], error: null } : s
      ),
    }))
  },

  deleteSession: async id => {
    await window.electronAPI.common.deleteConnection(id)
    const session = get().sessions.find(s => s.id === id)
    if (session?.isConnected) {
      await window.electronAPI.protocol.disconnect(id)
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

  updateCurrentPath: (connectionId, path) => {
    set(state => ({
      sessions: state.sessions.map(s => (s.id === connectionId ? { ...s, currentPath: path } : s)),
    }))
  },

  setFiles: (connectionId, files) => {
    const safeFiles = sanitizeFiles(files)
    set(state => ({
      sessions: state.sessions.map(s => (s.id === connectionId ? { ...s, files: safeFiles } : s)),
    }))
  },

  setLoading: (connectionId, loading) => {
    set(state => ({
      sessions: state.sessions.map(s => (s.id === connectionId ? { ...s, isLoading: loading } : s)),
    }))
  },

  setError: (connectionId, error) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === connectionId ? { ...s, error, isConnected: error ? false : s.isConnected } : s
      ),
    }))
  },

  refreshCurrentDirectory: async connectionId => {
    let session = get().sessions.find(s => s.id === connectionId)
    if (!session) return

    set(state => ({
      sessions: state.sessions.map(s =>
        s.id === connectionId ? { ...s, isLoading: true, error: null } : s
      ),
    }))

    try {
      session = get().sessions.find(s => s.id === connectionId)
      if (!session) return

      const result = await window.electronAPI.protocol.list(connectionId, session.currentPath)
      const safeFiles = sanitizeFiles(result)
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === connectionId ? { ...s, files: safeFiles, isLoading: false } : s
        ),
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to list directory'
      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === connectionId ? { ...s, error: errorMsg, isLoading: false, files: [] } : s
        ),
      }))
    }
  },

  reconnectSession: async (session, password) => {
    try {
      const { connectionId, ...configWithoutId } = session.config
      const configToUse = {
        ...configWithoutId,
        password: password ?? session.config.password,
      }

      const newConnectionId = await window.electronAPI.protocol.connect(configToUse)

      set(state => ({
        sessions: state.sessions.map(s =>
          s.id === session.id
            ? {
                ...s,
                id: newConnectionId,
                config: {
                  ...session.config,
                  ...configToUse,
                  connectionId: newConnectionId,
                },
                isConnected: true,
                error: null,
                currentPath: '/',
              }
            : s
        ),
        activeSessionId: newConnectionId,
      }))

      await get().refreshCurrentDirectory(newConnectionId)
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

  loadSavedConnections: async () => {
    try {
      const savedConnections = await window.electronAPI.common.getSavedConnections()
      if (!savedConnections || !Array.isArray(savedConnections)) {
        return
      }

      const sessionsToAdd: Session[] = savedConnections.map((config: ConnectionConfig) => ({
        id: config.connectionId,
        config: config,
        currentPath: '/',
        files: [],
        isConnected: false,
        isLoading: false,
        error: null,
      }))

      set({ sessions: sessionsToAdd })
    } catch (error) {
      console.error('Failed to load saved connections:', error)
    }
  },
}))

export default useSessionStore
