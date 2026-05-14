import type { FileInfo } from './file.js'
import type { ConnectionConfig } from './connection.js'
import type { OperationResult } from './operation-result.js'

export interface WindowControlAPI {
  minimize: () => void
  maximize: () => void
  close: () => void
  getState: () => Promise<{ isMaximized: boolean; platform: string }>
  onStateChange: (callback: (state: { isMaximized: boolean }) => void) => () => void
  createChild: (options: {
    id: string
    route: string
    width?: number
    height?: number
    title?: string
  }) => Promise<string>
  closeChild: (id: string) => Promise<boolean>
}

export interface ProtocolAPI {
  connect: (config: ConnectionConfig) => Promise<OperationResult>
  disconnect: (sessionId: string) => Promise<void>
  list: (sessionId: string, path: string) => Promise<unknown>
  onSessionDisconnected: (
    callback: (event: {
      sessionId: string
      connectionUuid: string
      protocol: string
      name: string
    }) => void
  ) => () => void
  delete: (sessionId: string, file: FileInfo) => Promise<void>
  rename: (sessionId: string, file: FileInfo, newName: string) => Promise<void>
  mkdir: (sessionId: string, path: string) => Promise<void>
  copy: (sessionId: string, file: FileInfo, targetPath: string) => Promise<void>
  move: (sessionId: string, file: FileInfo, targetPath: string) => Promise<void>
}

export interface CommonAPI {
  storeGet: (key: string) => Promise<unknown>
  storeSet: (key: string, value: unknown) => Promise<void>
  storeDelete: (key: string) => Promise<void>
  showOpenDialog: (options: {
    properties: string[]
  }) => Promise<{ canceled: boolean; filePaths: string[] } | undefined>
  showSaveDialog: (
    options: unknown
  ) => Promise<{ canceled: boolean; filePath?: string } | undefined>
  getSavedConnections: () => Promise<unknown>
  deleteConnection: (connectionUuid: string) => Promise<void>
  getCredential: (connectionUuid: string) => Promise<unknown>
  getTempDir: () => Promise<string>
  getDownloadDir: () => Promise<string>
  getLastError: () => Promise<unknown>
  saveKnownHost: (record: {
    connectionUuid: string
    fingerprint: string
  }) => Promise<{ success: boolean }>
  deleteKnownHost: (connectionUuid: string) => Promise<{ success: boolean }>
}

export interface ElectronAPI {
  windowControl: WindowControlAPI
  windowMeta: { windowId: string; route: string }
  protocol: ProtocolAPI
  common: CommonAPI
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
