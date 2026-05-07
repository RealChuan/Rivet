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
  list(sessionId: string, path: string): Promise<FileInfo[]>
  mkdir(sessionId: string, path: string): Promise<void>
  rename(sessionId: string, file: FileInfo, newName: string): Promise<void>
  delete(sessionId: string, files: FileInfo[]): Promise<void>
  copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
  move(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
  uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void>
  downloadFile(
    sessionId: string,
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void>
  cancelTransfer(transferId: string): Promise<void>
  storeGet(key: string): unknown
  storeSet(key: string, value: unknown): void
  storeDelete(key: string): void
  showOpenDialog(options: {
    title?: string
    defaultPath?: string
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
  }): Promise<{ canceled: boolean; filePaths: string[] } | null>
  showSaveDialog(options: {
    title?: string
    defaultPath?: string
  }): Promise<{ canceled: boolean; filePath?: string } | null>
  getSavedConnections(): Promise<ConnectionConfig[]>
  deleteConnection(id: string): Promise<void>
  getCredential(credentialId: string): Promise<string | null>
  getTempDir(): Promise<string>
  getDownloadDir(): Promise<string>
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
