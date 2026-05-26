import { create } from 'zustand'
import {
  type Session,
  type FileInfo,
  type ConnectionConfig,
  isProtocolResponseErr,
} from '@shared/types/index.js'
import { ProtocolStatus, SftpStatus } from '@shared/constants/index.js'
import { useConnectionStore } from './connection.js'
import { useHostKeyStore } from '@renderer/features/host-key/stores/host-key.js'
import { formatErrorMessage } from '@shared/utils/index.js'

export interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  currentListRequestId: string | null

  setActiveSession: (sessionId: string) => void
  updateCurrentPath: (sessionId: string, path: string) => void
  setFiles: (sessionId: string, files: FileInfo[]) => void
  setLoading: (sessionId: string, loading: boolean) => void
  setError: (sessionId: string, error: string | null) => void
  refreshCurrentDirectory: (sessionId: string) => Promise<void>
  addSession: (session: Session) => void
  removeSession: (sessionId: string) => void
  connectSession: (config: ConnectionConfig) => Promise<boolean>
  reconnectSession: (
    connectionId: string,
    passwordConfig?: Partial<{ password?: string; savePassword?: boolean }>
  ) => Promise<boolean>

  getSessionByConnectionId: (connectionId: string) => Session | undefined
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

const showHostKeyVerificationDialog = async (config: {
  type: 'first-connect' | 'mismatch'
  hash: string
  previousHash: string | undefined
  sessionId: string
  connectionId: string
}) => {
  const hostKeyStore = useHostKeyStore.getState()

  return new Promise<boolean>(resolve => {
    const handleConfirm = () => {
      hostKeyStore.setHostKeyVerificationDialog({ open: false })
      resolve(true)
    }

    const handleCancel = () => {
      hostKeyStore.setHostKeyVerificationDialog({ open: false })
      resolve(false)
    }

    hostKeyStore.setHostKeyVerificationDialog({
      type: config.type,
      hash: config.hash,
      previousHash: config.previousHash,
      sessionId: config.sessionId,
      connectionId: config.connectionId,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
      open: true,
    })
  })
}

const handleConnectWithHostKey = async (
  fullConfig: ConnectionConfig
): Promise<{ success: boolean; sessionId: string | null; retry: boolean }> => {
  const response = await window.electronAPI.protocol.connect(fullConfig)

  if (isProtocolResponseErr(response)) {
    throw new Error(response.error.message)
  }

  const operationResult = response.value

  if (operationResult.statusCode === ProtocolStatus.OK) {
    return { success: true, sessionId: operationResult.sessionId, retry: false }
  }

  if (operationResult.statusCode === ProtocolStatus.FIRST_CONNECT) {
    const userConfirmed = await showHostKeyVerificationDialog({
      type: 'first-connect',
      hash: operationResult.detail.hash,
      previousHash: undefined,
      sessionId: operationResult.sessionId,
      connectionId: fullConfig.id,
    })

    if (!userConfirmed) {
      await window.electronAPI.protocol.disconnect(operationResult.sessionId)
      await window.electronAPI.hostKey.delete(fullConfig.id)
      return { success: false, sessionId: null, retry: false }
    }

    await window.electronAPI.hostKey.save({
      connectionId: fullConfig.id,
      hash: operationResult.detail.hash,
    })

    return { success: true, sessionId: operationResult.sessionId, retry: false }
  }

  if (operationResult.statusCode === SftpStatus.HOST_KEY_MISMATCH) {
    const userConfirmed = await showHostKeyVerificationDialog({
      type: 'mismatch',
      hash: operationResult.detail.hash,
      previousHash: operationResult.detail.previousHash,
      sessionId: '',
      connectionId: fullConfig.id,
    })

    if (!userConfirmed) {
      return { success: false, sessionId: null, retry: false }
    }

    await window.electronAPI.hostKey.save({
      connectionId: fullConfig.id,
      hash: operationResult.detail.hash,
    })

    return { success: false, sessionId: null, retry: true }
  }

  return { success: false, sessionId: null, retry: false }
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  currentListRequestId: null,

  getSessionByConnectionId: connectionId => {
    return get().sessions.find(s => s.connectionId === connectionId)
  },

  getSessionById: sessionId => {
    return get().sessions.find(s => s.sessionId === sessionId)
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

    const requestId = window.electronAPI.utils.generateUuid()

    const oldRequestId = get().currentListRequestId
    if (oldRequestId) {
      void window.electronAPI.protocol.cancel(oldRequestId)
    }

    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, isLoading: true, error: null } : s
      ),
      currentListRequestId: requestId,
    }))

    const response = await window.electronAPI.protocol.list(
      sessionId,
      session.currentPath,
      requestId
    )

    if (requestId !== get().currentListRequestId) {
      return
    }

    if (isProtocolResponseErr(response)) {
      set(state => ({
        sessions: state.sessions.map(s =>
          s.sessionId === sessionId
            ? {
                ...s,
                error: formatErrorMessage(response.error) || 'Failed to list directory',
                isLoading: false,
                files: [],
              }
            : s
        ),
      }))
      return
    }

    const safeFiles = sanitizeFiles(response.value)
    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, files: safeFiles, isLoading: false } : s
      ),
    }))
  },

  addSession: session => {
    set(state => ({
      sessions: [...state.sessions, session],
      activeSessionId: session.sessionId,
    }))
  },

  removeSession: sessionId => {
    set(state => ({
      sessions: state.sessions.filter(s => s.sessionId !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
    }))
  },

  connectSession: async (config: ConnectionConfig) => {
    let result = await handleConnectWithHostKey(config)

    while (result.retry) {
      result = await handleConnectWithHostKey(config)
    }

    if (!result.success || !result.sessionId) {
      return false
    }

    const session: Session = {
      sessionId: result.sessionId,
      connectionId: config.id,
      currentPath: '/',
      files: [],
      isConnected: true,
      isLoading: false,
      error: null,
    }
    set(state => ({
      sessions: state.sessions.filter(s => s.connectionId !== config.id).concat(session),
      activeSessionId: result.sessionId,
    }))

    await new Promise(resolve => setTimeout(resolve, 100))
    await get().refreshCurrentDirectory(result.sessionId)

    return true
  },

  reconnectSession: async (id, passwordConfig?) => {
    const connection = useConnectionStore.getState().getConnectionById(id)
    if (!connection) throw new Error('Connection not found')

    const configToConnect = passwordConfig ? { ...connection, ...passwordConfig } : connection
    return get().connectSession(configToConnect)
  },
}))

export default useSessionStore
