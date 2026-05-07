export interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modifyTime: number
  permissions?: string
  owner?: string
  absolutePath: string
}

export interface FileProtocol {
  connect(config: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    basePath?: string
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
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void>
  mkdir(sessionId: string, path: string): Promise<void>
  rename(sessionId: string, file: FileInfo, newName: string): Promise<void>
  delete(sessionId: string, files: FileInfo[]): Promise<void>
  copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
  move(sessionId: string, file: FileInfo, targetPath: string): Promise<void>
}

export abstract class BaseProtocolImpl<T = any> implements FileProtocol {
  protected sessions: Map<string, SessionHandle<T>> = new Map()

  protected getSessionHandle(sessionId: string): SessionHandle<T> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    return handle
  }

  protected calculateProgress(transferred: number, totalSize: number): number {
    if (totalSize <= 0) return 100
    return Math.min(Math.round((transferred / totalSize) * 100), 100)
  }

  protected joinPaths(...parts: string[]): string {
    const filtered = parts.filter(Boolean).join('/')
    return this.normalizePath(filtered)
  }

  protected normalizePath(path: string): string {
    const parts = path.split('/').filter(Boolean)
    if (parts.length === 0) return '/'
    return '/' + parts.join('/')
  }

  async connect(config: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
    basePath?: string
  }): Promise<string> {
    throw new Error('Not implemented')
  }

  async disconnect(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId)
  }

  async list(sessionId: string, path: string): Promise<FileInfo[]> {
    throw new Error('Not implemented')
  }

  async uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    throw new Error('Not implemented')
  }

  async downloadFile(
    sessionId: string,
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    throw new Error('Not implemented')
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async delete(sessionId: string, files: FileInfo[]): Promise<void> {
    throw new Error('Not implemented')
  }

  async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    throw new Error('Not implemented')
  }

  async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    throw new Error('Not implemented')
  }
}

export interface SessionHandle<T = any> {
  client: T
  config: {
    host: string
    username: string
    password?: string
    privateKey?: string
    basePath?: string
  }
}

export default FileProtocol
