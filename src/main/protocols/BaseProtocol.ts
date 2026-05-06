export interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modifyTime: number
}

export interface FileProtocol {
  connect(config: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  }): Promise<string>
  disconnect(sessionId: string): Promise<void>
  list(sessionId: string, path: string): Promise<FileInfo[]>
  uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void>
  downloadFile(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void>
  mkdir(sessionId: string, path: string): Promise<void>
  rename(sessionId: string, oldPath: string, newPath: string): Promise<void>
  delete(sessionId: string, path: string): Promise<void>
}

export default FileProtocol
