import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  type ConnectionConfig,
  type ConnectionConfigWithoutPassword,
  type FileInfo,
  type Session,
} from '@shared/types/index.js'

export interface SessionStore {
  connections: ConnectionConfigWithoutPassword[]
  sessions: Session[]
  activeSessionId: string | null

  addConnection: (config: Omit<ConnectionConfig, 'connectionUuid'>) => Promise<string>
  updateConnection: (
    connectionUuid: string,
    config: Omit<ConnectionConfig, 'connectionUuid'>
  ) => Promise<void>
  removeConnection: (connectionUuid: string) => Promise<void>
  deleteConnection: (connectionUuid: string) => Promise<void>
  setActiveSession: (sessionId: string) => void
  updateCurrentPath: (sessionId: string, path: string) => void
  setFiles: (sessionId: string, files: FileInfo[]) => void
  setLoading: (sessionId: string, loading: boolean) => void
  setError: (sessionId: string, error: string | null) => void
  refreshCurrentDirectory: (sessionId: string) => Promise<void>
  reconnectSession: (
    connectionUuid: string,
    passwordConfig?: Partial<{ password?: string; savePassword?: boolean }>
  ) => Promise<void>
  loadSavedConnections: () => Promise<void>

  getSessionByconnectionUuid: (connectionUuid: string) => Session | undefined
  getSessionById: (sessionId: string) => Session | undefined
}

const sanitizeFiles = (files: unknown): FileInfo[] => {
  if (!files || !Array.isArray(files)) {
    return []
  }
  return files
    .filter((file): file is FileInfo => {
      if (!file || typeof file !== 'object') return false
      const f = file as Record<string, unknown>
      return (
        typeof f.name === 'string' &&
        (f.type === 'file' || f.type === 'directory') &&
        typeof f.size === 'number' &&
        typeof f.modifyTime === 'number' &&
        typeof f.absolutePath === 'string'
      )
    })
    .map(file => ({
      name: String(file.name),
      type: file.type === 'directory' ? 'directory' : 'file',
      size: Number(file.size || 0),
      modifyTime: Number(file.modifyTime || 0),
      permissions: typeof file.permissions === 'string' ? file.permissions : '',
      owner: typeof file.owner === 'string' ? file.owner : '',
      absolutePath: String(file.absolutePath),
    }))
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  connections: [],
  sessions: [],
  activeSessionId: null,

  getSessionByconnectionUuid: connectionUuid => {
    return get().sessions.find(s => s.connectionUuid === connectionUuid)
  },

  getSessionById: sessionId => {
    return get().sessions.find(s => s.sessionId === sessionId)
  },

  addConnection: async config => {
    const connectionUuid = uuidv4()

    const fullConfig: ConnectionConfig = {
      connectionUuid,
      name: config.name,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password ?? '',
      savePassword: config.savePassword ?? false,
      ...(config.basePath ? { basePath: config.basePath } : {}),
      ...(config.scheme ? { scheme: config.scheme } : {}),
      ...(config.rejectUnauthorized !== undefined
        ? { rejectUnauthorized: config.rejectUnauthorized }
        : {}),
    }

    const sessionId = await window.electronAPI.protocol.connect(fullConfig)

    const session: Session = {
      sessionId,
      connectionUuid,
      currentPath: '/',
      files: [],
      isConnected: true,
      isLoading: true,
      error: null,
    }

    const configWithoutPassword: ConnectionConfigWithoutPassword = {
      connectionUuid,
      name: config.name,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
      username: config.username,
      savePassword: config.savePassword ?? false,
      ...(config.basePath ? { basePath: config.basePath } : {}),
      ...(config.scheme ? { scheme: config.scheme } : {}),
      ...(config.rejectUnauthorized !== undefined
        ? { rejectUnauthorized: config.rejectUnauthorized }
        : {}),
    }

    set(state => ({
      connections: [...state.connections, configWithoutPassword],
      sessions: [...state.sessions, session],
      activeSessionId: sessionId,
    }))

    await new Promise(resolve => setTimeout(resolve, 100))
    await get().refreshCurrentDirectory(sessionId)

    return connectionUuid
  },

  updateConnection: async (connectionUuid, config) => {
    const session = get().sessions.find(s => s.connectionUuid === connectionUuid)
    if (session?.isConnected && session.sessionId) {
      await window.electronAPI.protocol.disconnect(session.sessionId)
    }

    const configWithoutPassword: ConnectionConfigWithoutPassword = {
      connectionUuid,
      name: config.name,
      protocol: config.protocol,
      host: config.host,
      port: config.port,
      username: config.username,
      basePath: config.basePath ?? undefined,
      scheme: config.scheme ?? undefined,
      rejectUnauthorized: config.rejectUnauthorized ?? undefined,
    } as ConnectionConfigWithoutPassword
    if (config.savePassword) {
      configWithoutPassword.savePassword = config.savePassword
    }

    let newSessionId: string | undefined
    let isConnected = false

    if (session?.isConnected || config.password) {
      try {
        newSessionId = await window.electronAPI.protocol.connect(configWithoutPassword)
        isConnected = true
      } catch {
        isConnected = false
      }
    }

    set(state => ({
      connections: state.connections.map(c =>
        c.connectionUuid === connectionUuid ? configWithoutPassword : c
      ),
      sessions: state.sessions
        .filter(s => s.connectionUuid !== connectionUuid)
        .concat(
          isConnected && newSessionId
            ? [
                {
                  sessionId: newSessionId,
                  connectionUuid,
                  currentPath: '/',
                  files: [],
                  isConnected: true,
                  isLoading: true,
                  error: null,
                },
              ]
            : []
        ),
      activeSessionId: isConnected
        ? (newSessionId ?? state.activeSessionId)
        : state.activeSessionId,
    }))

    if (isConnected && newSessionId) {
      await new Promise(resolve => setTimeout(resolve, 100))
      await get().refreshCurrentDirectory(newSessionId)
    }
  },

  removeConnection: async connectionUuid => {
    const session = get().sessions.find(s => s.connectionUuid === connectionUuid)
    if (session?.isConnected && session.sessionId) {
      await window.electronAPI.protocol.disconnect(session.sessionId)
    }

    set(state => ({
      sessions: state.sessions.filter(s => s.connectionUuid !== connectionUuid),
      activeSessionId: state.activeSessionId === session?.sessionId ? null : state.activeSessionId,
    }))
  },

  deleteConnection: async connectionUuid => {
    const session = get().sessions.find(s => s.connectionUuid === connectionUuid)
    if (session?.isConnected && session.sessionId) {
      await window.electronAPI.protocol.disconnect(session.sessionId)
    }

    await window.electronAPI.common.deleteConnection(connectionUuid)

    set(state => ({
      connections: state.connections.filter(c => c.connectionUuid !== connectionUuid),
      sessions: state.sessions.filter(s => s.connectionUuid !== connectionUuid),
      activeSessionId: state.activeSessionId === session?.sessionId ? null : state.activeSessionId,
    }))
  },

  setActiveSession: sessionId => {
    set({ activeSessionId: sessionId })
  },

  updateCurrentPath: (sessionId, path) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, currentPath: path } : s
      ),
    }))
  },

  setFiles: (sessionId, files) => {
    const safeFiles = sanitizeFiles(files)
    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, files: safeFiles } : s
      ),
    }))
  },

  setLoading: (sessionId, loading) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, isLoading: loading } : s
      ),
    }))
  },

  setError: (sessionId, error) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, error, isConnected: !error } : s
      ),
    }))
  },

  refreshCurrentDirectory: async sessionId => {
    const session = get().sessions.find(s => s.sessionId === sessionId)
    if (!session) return

    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, isLoading: true, error: null } : s
      ),
    }))

    try {
      const result = await window.electronAPI.protocol.list(sessionId, session.currentPath)
      const safeFiles = sanitizeFiles(result)
      set(state => ({
        sessions: state.sessions.map(s =>
          s.sessionId === sessionId ? { ...s, files: safeFiles, isLoading: false } : s
        ),
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to list directory'
      set(state => ({
        sessions: state.sessions.map(s =>
          s.sessionId === sessionId ? { ...s, error: errorMsg, isLoading: false, files: [] } : s
        ),
      }))
    }
  },

  reconnectSession: async (connectionUuid, passwordConfig?) => {
    const connection = get().connections.find(c => c.connectionUuid === connectionUuid)
    if (!connection) throw new Error('Connection not found')

    const configToConnect = passwordConfig ? { ...connection, ...passwordConfig } : connection
    const sessionId = await window.electronAPI.protocol.connect(configToConnect)

    set(state => ({
      sessions: state.sessions
        .filter(s => s.connectionUuid !== connectionUuid)
        .concat({
          sessionId,
          connectionUuid,
          currentPath: '/',
          files: [],
          isConnected: true,
          isLoading: true,
          error: null,
        }),
      activeSessionId: sessionId,
    }))

    await get().refreshCurrentDirectory(sessionId)
  },

  loadSavedConnections: async () => {
    try {
      const savedConnections = await window.electronAPI.common.getSavedConnections()
      if (!savedConnections || !Array.isArray(savedConnections)) {
        return
      }

      set({ connections: savedConnections as ConnectionConfig[], sessions: [] })
    } catch (error) {
      console.error('Failed to load saved connections:', error)
    }
  },
}))

export default useSessionStore
