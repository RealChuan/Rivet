import type { FileInfo } from './file.js'

export interface TransferTask {
  id: string
  sessionId: string
  type: 'upload' | 'download'
  localPath: string
  remotePath: string
  file: FileInfo | undefined
  status: 'pending' | 'active' | 'completed' | 'failed'
  progress: number
  error: string | undefined
}

export interface ProgressEvent {
  transferId: string
  connectionUuid: string
  operation: 'upload' | 'download'
  path: string
  percent: number
}
