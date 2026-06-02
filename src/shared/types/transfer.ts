import type {
  TransferTaskStatus,
  TransferItemType,
  ConflictAction,
  UploadOperationType,
  UploadOperationStatus,
} from '../constants/transfer.js'

export interface TransferTask {
  id: string
  sessionId: string
  localPath: string
  remotePath: string
  itemName: string
  itemType: TransferItemType
  status: TransferTaskStatus
  conflictAction?: ConflictAction
  renamedName?: string
  fileSize: number
  transferredSize: number
  speed?: number
  createdAt: number
  startedAt?: number
  errorMessage?: string
  totalFileCount?: number
  completedFileCount?: number
  activeFileCount?: number
  waitingFileCount?: number
}

export interface UploadOperation {
  id: string
  parentTaskId: string
  type: UploadOperationType
  localPath?: string
  remotePath: string
  itemName: string
  status: UploadOperationStatus
  fileSize?: number
  transferredSize: number
  startedAt?: number
  errorMessage?: string
}

export interface OperationProgressInfo {
  id: string
  itemName: string
  type: UploadOperationType
  transferredSize: number
  fileSize?: number
  status: UploadOperationStatus
  startedAt?: number
  speed?: number
}

export interface TransferProgressData {
  taskId: string
  transferredSize: number
  fileSize?: number
  speed?: number
  totalFileCount?: number
  completedFileCount?: number
  activeFileCount?: number
  waitingFileCount?: number
  activeOperations?: OperationProgressInfo[]
}

export interface ConflictItem {
  localPath: string
  remotePath: string
  itemName: string
  itemType: TransferItemType
  remoteFileType?: string
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
