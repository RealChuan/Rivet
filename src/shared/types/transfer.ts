import type {
  OperationStatus,
  ConflictAction,
  TransferDirection,
  TransferOperationType,
} from '../constants/transfer.js'
import type { FileType } from '../constants/ui.js'

export interface TransferTask {
  id: string
  sessionId: string
  direction: TransferDirection
  localPath: string
  localDir?: string
  remotePath: string
  itemName: string
  itemType: FileType
  status: OperationStatus
  conflictAction?: ConflictAction
  renamedName?: string
  fileSize: number
  transferredSize: number
  speed?: number
  createdAt: number
  startedAt?: number | undefined
  errorMessage?: string | undefined
  totalFileCount?: number
  completedFileCount?: number | undefined
  activeFileCount?: number | undefined
  waitingFileCount?: number | undefined
  /** 目录扫描是否结束。在此之前 `totalFileCount` 只是“已发现”的数量，不是总数。 */
  scanCompleted?: boolean
}

export interface UploadOperation {
  id: string
  parentTaskId: string
  type: TransferOperationType
  localPath?: string
  remotePath: string
  itemName: string
  status: OperationStatus
  fileSize?: number
  transferredSize: number
  startedAt?: number | undefined
  errorMessage?: string | undefined
}

export interface OperationProgressInfo {
  id: string
  itemName: string
  type: TransferOperationType
  transferredSize: number
  fileSize?: number
  status: OperationStatus
  startedAt?: number
  speed?: number
}

export interface TransferProgressData {
  taskId: string
  transferredSize: number
  fileSize?: number
  speed?: number
  totalFileCount?: number
  completedFileCount?: number | undefined
  activeFileCount?: number | undefined
  waitingFileCount?: number | undefined
  /** 目录扫描是否结束。在此之前 `totalFileCount` 只是“已发现”的数量，不是总数。 */
  scanCompleted?: boolean
  activeOperations?: OperationProgressInfo[]
}

export interface ConflictItem {
  localPath: string
  remotePath: string
  itemName: string
  itemType: FileType
  remoteFileType: FileType
}

export interface ConflictResolution {
  localPath: string
  action: ConflictAction
  newName?: string
}

export interface DeduplicateResult {
  added: TransferTask[]
  duplicates: TransferTask[]
}

export interface LocalFileInfo {
  name: string
  size: number
  type: FileType
}
