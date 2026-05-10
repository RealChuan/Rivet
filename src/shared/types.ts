export interface ConnectionConfig {
  connectionId: string
  name: string
  protocol: 'sftp' | 'webdav'
  host: string
  port: number
  username: string
  password?: string
  basePath?: string
  scheme?: 'http' | 'https'
  rejectUnauthorized?: boolean
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
  connectionId: string
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
  language: 'zh-CN' | 'en-US' | ''
}

export interface ProtocolAPI {
  connect(config: Omit<ConnectionConfig, 'connectionId'>): Promise<string>
  disconnect(connectionId: string): Promise<void>
  list(connectionId: string, path: string): Promise<FileInfo[]>
  mkdir(connectionId: string, path: string): Promise<void>
  rename(connectionId: string, file: FileInfo, newName: string): Promise<void>
  delete(connectionId: string, files: FileInfo[]): Promise<void>
  copy(connectionId: string, file: FileInfo, targetPath: string): Promise<void>
  move(connectionId: string, file: FileInfo, targetPath: string): Promise<void>
  uploadFile(
    connectionId: string,
    localPath: string,
    remotePath: string
  ): Promise<{ transferId: string; success: boolean }>
  downloadFile(
    connectionId: string,
    file: FileInfo,
    localPath: string
  ): Promise<{ transferId: string; success: boolean }>
  cancelTransfer(transferId: string): Promise<void>
  onProgress(callback: (event: ProgressEvent) => void): () => void
}

export interface CommonAPI {
  storeGet(key: string): Promise<unknown>
  storeSet(key: string, value: unknown): Promise<void>
  storeDelete(key: string): Promise<void>
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
  deleteConnection(connectionId: string): Promise<void>
  getCredential(connectionId: string): Promise<string | null>
  getTempDir(): Promise<string>
  getDownloadDir(): Promise<string>
  getLastError(): Promise<string | null>
}

export interface ElectronAPI {
  protocol: ProtocolAPI
  common: CommonAPI
}

export interface ProgressEvent {
  transferId: string
  connectionId: string
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
