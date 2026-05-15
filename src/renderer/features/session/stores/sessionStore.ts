import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import {
  type ConnectionConfig,
  type ConnectionConfigWithoutPassword,
  type FileInfo,
  type Session,
  type HostKeyDialogState,
} from '@shared/types/index.js'
import { ProtocolStatus, SftpStatus } from '@shared/constants/index.js'

export interface SessionStore {
  connections: ConnectionConfigWithoutPassword[]
  sessions: Session[]
  activeSessionId: string | null
  hostKeyDialog: HostKeyDialogState
  requestCounters: Record<string, number>

  addConnection: (config: Omit<ConnectionConfig, 'connectionUuid'>) => Promise<string | null>
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
  ) => Promise<string | null>
  loadSavedConnections: () => Promise<void>

  setHostKeyDialog: (state: Partial<HostKeyDialogState>) => void
  closeHostKeyDialog: () => void

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
      const size = typeof f.size === 'number' ? f.size : NaN
      return (
        typeof f.name === 'string' &&
        f.name.length > 0 &&
        (f.type === 'file' || f.type === 'directory') &&
        Number.isFinite(size) &&
        size >= 0 &&
        Number.isFinite(f.modifyTime) &&
        typeof f.absolutePath === 'string' &&
        f.absolutePath.length > 0
      )
    })
    .map(file => ({
      name: String(file.name).replace(/[\\/:*?"<>|]/g, '_'),
      type: file.type === 'directory' ? 'directory' : 'file',
      size: Number(file.size),
      modifyTime: Number(file.modifyTime),
      permissions: typeof file.permissions === 'string' ? file.permissions : '',
      owner: typeof file.owner === 'string' ? file.owner : '',
      absolutePath: String(file.absolutePath),
    }))
}

/**
 * 公共函数：处理 connect 调用和 host key 对话框逻辑
 */
const handleConnectWithHostKey = async (
  fullConfig: ConnectionConfig,
  set: (partial: Partial<SessionStore>) => void
): Promise<{ sessionId: string | null; shouldProceed: boolean }> => {
  const result = await window.electronAPI.protocol.connect(fullConfig)

  if (result.statusCode === ProtocolStatus.OK) {
    return { sessionId: result.sessionId, shouldProceed: true }
  }

  if (result.statusCode === ProtocolStatus.FIRST_CONNECT) {
    set({
      hostKeyDialog: {
        open: true,
        type: 'first-connect',
        fingerprint: result.detail.fingerprint,
        previousFingerprint: undefined,
        sessionId: result.sessionId,
        connectionUuid: fullConfig.connectionUuid,
      },
    })
    return { sessionId: result.sessionId, shouldProceed: false }
  }

  if (result.statusCode === SftpStatus.HOST_KEY_MISMATCH) {
    set({
      hostKeyDialog: {
        open: true,
        type: 'mismatch',
        fingerprint: result.detail.fingerprint,
        previousFingerprint: result.detail.previousFingerprint,
        sessionId: '',
        connectionUuid: fullConfig.connectionUuid,
      },
    })
    return { sessionId: null, shouldProceed: false }
  }

  throw new Error(`Unexpected status: ${result.statusCode}`)
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  connections: [],
  sessions: [],
  activeSessionId: null,
  hostKeyDialog: {
    open: false,
    type: 'first-connect',
    fingerprint: '',
    previousFingerprint: undefined,
    sessionId: '',
    connectionUuid: '',
  },
  requestCounters: {},

  getSessionByconnectionUuid: connectionUuid => {
    return get().sessions.find(s => s.connectionUuid === connectionUuid)
  },

  getSessionById: sessionId => {
    return get().sessions.find(s => s.sessionId === sessionId)
  },

  setHostKeyDialog: state => {
    set(prev => ({
      hostKeyDialog: { ...prev.hostKeyDialog, ...state, open: true },
    }))
  },

  closeHostKeyDialog: () => {
    set(prev => ({
      hostKeyDialog: { ...prev.hostKeyDialog, open: false },
    }))
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

    const { sessionId, shouldProceed } = await handleConnectWithHostKey(fullConfig, set)

    if (!sessionId) {
      return null
    }

    const session: Session = {
      sessionId,
      connectionUuid,
      currentPath: '/',
      files: [],
      isConnected: true,
      isLoading: true,
      error: null,
    }
    set(state => ({
      connections: [
        ...state.connections,
        {
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
        },
      ],
      sessions: [...state.sessions, session],
      activeSessionId: sessionId,
    }))

    if (shouldProceed) {
      await new Promise(resolve => setTimeout(resolve, 100))
      await get().refreshCurrentDirectory(sessionId)
    }

    return shouldProceed ? connectionUuid : null
  },

  updateConnection: async (connectionUuid, config) => {
    const session = get().sessions.find(s => s.connectionUuid === connectionUuid)
    const oldSessionId = session?.sessionId
    if (oldSessionId) {
      await window.electronAPI.protocol.disconnect(oldSessionId)
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
    let shouldRefresh = false

    if (session?.isConnected || config.password) {
      try {
        const fullConfig: ConnectionConfig = {
          ...configWithoutPassword,
          connectionUuid,
          password: config.password ?? '',
        }
        const { sessionId, shouldProceed } = await handleConnectWithHostKey(fullConfig, set)

        if (sessionId) {
          newSessionId = sessionId
          isConnected = true
          shouldRefresh = shouldProceed
        }
      } catch {
        isConnected = false
      }
    }

    set(state => {
      const restCounters = oldSessionId
        ? (({ [oldSessionId]: _, ...rest }) => rest)(state.requestCounters)
        : state.requestCounters
      return {
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
        requestCounters: restCounters,
        activeSessionId: isConnected
          ? (newSessionId ?? state.activeSessionId)
          : state.activeSessionId,
      }
    })

    if (shouldRefresh && newSessionId) {
      await new Promise(resolve => setTimeout(resolve, 100))
      await get().refreshCurrentDirectory(newSessionId)
    }
  },

  removeConnection: async connectionUuid => {
    const session = get().sessions.find(s => s.connectionUuid === connectionUuid)
    const sessionId = session?.sessionId
    if (sessionId) {
      await window.electronAPI.protocol.disconnect(sessionId)
    }

    set(state => {
      const restCounters = sessionId
        ? (({ [sessionId]: _, ...rest }) => rest)(state.requestCounters)
        : state.requestCounters
      return {
        sessions: state.sessions.filter(s => s.connectionUuid !== connectionUuid),
        requestCounters: restCounters,
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
      }
    })
  },

  deleteConnection: async connectionUuid => {
    const session = get().sessions.find(s => s.connectionUuid === connectionUuid)
    const sessionId = session?.sessionId
    if (sessionId) {
      await window.electronAPI.protocol.disconnect(sessionId)
    }

    await window.electronAPI.common.deleteConnection(connectionUuid)

    set(state => {
      const restCounters = sessionId
        ? (({ [sessionId]: _, ...rest }) => rest)(state.requestCounters)
        : state.requestCounters
      return {
        connections: state.connections.filter(c => c.connectionUuid !== connectionUuid),
        sessions: state.sessions.filter(s => s.connectionUuid !== connectionUuid),
        requestCounters: restCounters,
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
      }
    })
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

    const currentCount = (get().requestCounters[sessionId] ?? 0) + 1
    set(state => ({
      requestCounters: {
        ...state.requestCounters,
        [sessionId]: currentCount,
      },
    }))

    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, isLoading: true, error: null } : s
      ),
    }))

    try {
      const result = await window.electronAPI.protocol.list(sessionId, session.currentPath)

      if (get().requestCounters[sessionId] !== currentCount) {
        return
      }

      const safeFiles = sanitizeFiles(result)
      set(state => ({
        sessions: state.sessions.map(s =>
          s.sessionId === sessionId ? { ...s, files: safeFiles, isLoading: false } : s
        ),
      }))
    } catch (error) {
      if (get().requestCounters[sessionId] !== currentCount) {
        return
      }

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

    const existingSession = get().sessions.find(s => s.connectionUuid === connectionUuid)
    const existingSessionId = existingSession?.sessionId

    const configToConnect = passwordConfig ? { ...connection, ...passwordConfig } : connection
    const { sessionId, shouldProceed } = await handleConnectWithHostKey(configToConnect, set)

    if (!sessionId) {
      return null
    }

    const session: Session = {
      sessionId,
      connectionUuid,
      currentPath: '/',
      files: [],
      isConnected: true,
      isLoading: true,
      error: null,
    }
    set(state => {
      const restCounters = existingSessionId
        ? (({ [existingSessionId]: _, ...rest }) => rest)(state.requestCounters)
        : state.requestCounters
      return {
        sessions: state.sessions.filter(s => s.connectionUuid !== connectionUuid).concat(session),
        requestCounters: restCounters,
        activeSessionId: sessionId,
      }
    })

    if (shouldProceed) {
      await new Promise(resolve => setTimeout(resolve, 100))
      await get().refreshCurrentDirectory(sessionId)
    }

    return shouldProceed ? connectionUuid : null
  },

  loadSavedConnections: async () => {
    try {
      const savedConnections = await window.electronAPI.common.getSavedConnections()
      if (!savedConnections || !Array.isArray(savedConnections)) {
        return
      }

      set({
        connections: savedConnections as ConnectionConfig[],
        sessions: [],
        requestCounters: {},
      })
    } catch (error) {
      console.error('Failed to load saved connections:', error)
    }
  },
}))

export default useSessionStore
