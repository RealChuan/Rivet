import type { StoreKey } from '@shared/constants/index.js'
import type { ConnectionConfig } from './connection.js'
import type { FileInfo } from './file.js'
import type { OperationResult } from './operation-result.js'
import type { ProtocolResponse } from './protocol-request.js'
import type { ErrorInfo, Result } from './result.js'

export interface WindowAPI {
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
  getMeta: () => { windowId: string; route: string }
  refreshMeta: () => Promise<{ windowId: string; route: string }>
}

export interface ProtocolAPI {
  connect: (config: ConnectionConfig) => Promise<ProtocolResponse<OperationResult>>
  disconnect: (sessionId: string, requestId?: string) => Promise<ProtocolResponse<void>>
  list: (
    sessionId: string,
    path: string,
    requestId?: string
  ) => Promise<ProtocolResponse<FileInfo[]>>
  onSessionDisconnected: (
    callback: (event: {
      sessionId: string
      connectionId: string
      protocol: string
      name: string
    }) => void
  ) => () => void
  delete: (sessionId: string, file: FileInfo, requestId?: string) => Promise<ProtocolResponse<void>>
  rename: (
    sessionId: string,
    file: FileInfo,
    newName: string,
    requestId?: string
  ) => Promise<ProtocolResponse<void>>
  mkdir: (sessionId: string, path: string, requestId?: string) => Promise<ProtocolResponse<void>>
  copy: (
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string
  ) => Promise<ProtocolResponse<void>>
  move: (
    sessionId: string,
    file: FileInfo,
    targetPath: string,
    requestId?: string
  ) => Promise<ProtocolResponse<void>>
  cancel: (requestId: string) => Promise<void>
}

export interface ConfigAPI {
  get: (key: StoreKey) => Promise<Result<unknown, ErrorInfo>>
  set: (key: StoreKey, value: unknown) => Promise<Result<void, ErrorInfo>>
}

export interface DialogAPI {
  showOpenDialog: (options: {
    properties: string[]
  }) => Promise<Result<{ canceled: boolean; filePaths: string[] } | undefined, ErrorInfo>>
  showSaveDialog: (
    options: unknown
  ) => Promise<Result<{ canceled: boolean; filePath?: string } | undefined, ErrorInfo>>
}

export interface HostKeyAPI {
  save: (record: { connectionId: string; hash: string }) => Promise<Result<void, ErrorInfo>>
  delete: (connectionId: string) => Promise<Result<void, ErrorInfo>>
}

export interface SystemAPI {
  getTempDir: () => Promise<Result<string, ErrorInfo>>
  getDownloadDir: () => Promise<Result<string, ErrorInfo>>
}

export interface CryptoAPI {
  encryptPassword: (password: string) => Promise<Result<string, ErrorInfo>>
  decryptPassword: (encrypted: string) => Promise<Result<string, ErrorInfo>>
}

export interface ElectronAPI {
  window: WindowAPI
  protocol: ProtocolAPI
  config: ConfigAPI
  dialog: DialogAPI
  hostKey: HostKeyAPI
  system: SystemAPI
  crypto: CryptoAPI
  generateUuid: () => string
  windowMeta: { windowId: string; route: string }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
