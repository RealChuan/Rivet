import type { ConnectRequest, FileInfo, OperationResult } from '@shared/types/index.js'
import { forwardAbort } from './abort.js'
import { unwrap } from './result.js'

export const protocolApi = {
  connect: async (request: ConnectRequest): Promise<OperationResult> =>
    unwrap(await window.electronAPI.protocol.connect(request)),

  disconnect: async (sessionId: string, requestId?: string): Promise<void> => {
    unwrap(await window.electronAPI.protocol.disconnect(sessionId, requestId))
  },

  /**
   * 目录枚举。`requestId` 只用于把渲染层的 AbortSignal 桥接成主进程取消，
   * 不参与任何「结果是否陈旧」的判断——那由 TanStack Query 的 queryKey 负责。
   */
  list: async (sessionId: string, path: string, signal?: AbortSignal): Promise<FileInfo[]> => {
    const requestId = crypto.randomUUID()
    const dispose = forwardAbort(signal, () => {
      void protocolApi.cancel(requestId)
    })

    try {
      return unwrap(await window.electronAPI.protocol.list(sessionId, path, requestId))
    } finally {
      dispose()
    }
  },

  mkdir: async (sessionId: string, path: string): Promise<void> => {
    unwrap(await window.electronAPI.protocol.mkdir(sessionId, path))
  },

  rename: async (sessionId: string, file: FileInfo, newName: string): Promise<void> => {
    unwrap(await window.electronAPI.protocol.rename(sessionId, file, newName))
  },

  delete: async (sessionId: string, file: FileInfo): Promise<void> => {
    unwrap(await window.electronAPI.protocol.delete(sessionId, file))
  },

  copy: async (sessionId: string, file: FileInfo, targetPath: string): Promise<void> => {
    unwrap(await window.electronAPI.protocol.copy(sessionId, file, targetPath))
  },

  move: async (sessionId: string, file: FileInfo, targetPath: string): Promise<void> => {
    unwrap(await window.electronAPI.protocol.move(sessionId, file, targetPath))
  },

  cancel: async (requestId: string): Promise<void> => {
    await window.electronAPI.protocol.cancel(requestId)
  },

  calculateFolderStats: async (sessionId: string, path: string): Promise<void> => {
    unwrap(await window.electronAPI.protocol.calculateFolderStats(sessionId, path))
  },

  cancelCalculateFolderStats: async (sessionId: string): Promise<void> => {
    await window.electronAPI.protocol.cancelCalculateFolderStats(sessionId)
  },

  onFolderStatsProgress: (
    callback: Parameters<typeof window.electronAPI.protocol.onFolderStatsProgress>[0],
  ) => window.electronAPI.protocol.onFolderStatsProgress(callback),

  onSessionDisconnected: (
    callback: Parameters<typeof window.electronAPI.protocol.onSessionDisconnected>[0],
  ) => window.electronAPI.protocol.onSessionDisconnected(callback),
}
