import { create } from 'zustand'
import { FILE_TYPE } from '@shared/constants/index.js'
import { type FileInfo, isProtocolResponseErr, type Session } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'

export interface SessionStore {
  sessions: Session[]
  activeSessionId: string | null
  currentListRequestId: string | null

  setActiveSession: (sessionId: string) => void
  updateCurrentPath: (sessionId: string, path: string) => void
  setFiles: (sessionId: string, files: FileInfo[]) => void
  setLoading: (sessionId: string, loading: boolean) => void
  setOperating: (sessionId: string, operating: boolean) => void
  setError: (sessionId: string, error: string | null) => void
  refreshCurrentDirectory: (sessionId: string) => Promise<void>
  addSession: (session: Session) => void
  removeSession: (sessionId: string) => void

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
        (f.type === FILE_TYPE.FILE || f.type === FILE_TYPE.DIRECTORY) &&
        Number.isFinite(size) &&
        size >= 0 &&
        Number.isFinite(f.modifyTime) &&
        typeof f.absolutePath === 'string' &&
        f.absolutePath.length > 0
      )
    })
    .map(file => ({
      name: String(file.name).replace(/[\\/:*?"<>|]/g, '_'),
      type: file.type === FILE_TYPE.DIRECTORY ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE,
      size: Number(file.size),
      modifyTime: Number(file.modifyTime),
      permissions: typeof file.permissions === 'string' ? file.permissions : '',
      owner: typeof file.owner === 'string' ? file.owner : '',
      absolutePath: String(file.absolutePath),
    }))
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

  setOperating: (sessionId, operating) => {
    set(state => ({
      sessions: state.sessions.map(s =>
        s.sessionId === sessionId ? { ...s, isOperating: operating } : s
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

    const requestId = window.electronAPI.generateUuid()

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
}))
