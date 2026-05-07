export interface ConnectionConfig {
  id: string
  name: string
  protocol: 'sftp' | 'webdav'
  host: string
  port: number
  username: string
  credentialId: string
  basePath?: string
}

export interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modifyTime: number
  permissions?: string
  owner?: string
  absolutePath: string
}

export interface TransferTask {
  id: string
  sessionId: string
  type: 'upload' | 'download'
  localPath: string
  remotePath: string
  file?: FileInfo
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress: number
  error?: string
}

export interface UiSettings {
  theme: 'light' | 'dark' | 'system'
  language: 'zh-CN' | 'en-US'
  sidebarWidth: number
  queueDrawerOpen: boolean
  queueDrawerWidth: number
}

export interface ElectronAPI {
  connect(
    config: Omit<ConnectionConfig, 'id' | 'credentialId'> & {
      password?: string
      privateKey?: string
    }
  ): Promise<string>
  disconnect(sessionId: string): Promise<void>
  listDirectory(sessionId: string, path: string): Promise<FileInfo[]>
  createDirectory(sessionId: string, path: string): Promise<void>
  rename(sessionId: string, file: FileInfo, newName: string): Promise<void>
  delete(sessionId: string, files: FileInfo[]): Promise<void>
  move(sessionId: string, files: FileInfo[], targetDir: FileInfo): Promise<void>
  copy(sessionId: string, files: FileInfo[], targetDir: FileInfo): Promise<void>
  uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    signal?: AbortSignal
  ): Promise<void>
  downloadFile(
    sessionId: string,
    file: FileInfo,
    localPath: string,
    signal?: AbortSignal
  ): Promise<void>
  cancelTransfer(transferId: string): Promise<void>
  storeGet(key: string): unknown
  storeSet(key: string, value: unknown): void
  storeDelete(key: string): void
  onProgress(callback: (event: ProgressEvent) => void): () => void
  getLastError(): Promise<string | null>
}

export interface ProgressEvent {
  transferId: string
  sessionId: string
  operation: 'upload' | 'download'
  path: string
  percent: number
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
