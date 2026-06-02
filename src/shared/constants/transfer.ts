export const TRANSFER_TASK_STATUS = {
  WAITING: 'waiting',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type TransferTaskStatus = (typeof TRANSFER_TASK_STATUS)[keyof typeof TRANSFER_TASK_STATUS]

export const TRANSFER_ITEM_TYPE = {
  FILE: 'file',
  FOLDER: 'folder',
} as const

export type TransferItemType = (typeof TRANSFER_ITEM_TYPE)[keyof typeof TRANSFER_ITEM_TYPE]

export const CONFLICT_ACTION = {
  SKIP: 'skip',
  OVERWRITE: 'overwrite',
  KEEP_BOTH: 'keepBoth',
} as const

export type ConflictAction = (typeof CONFLICT_ACTION)[keyof typeof CONFLICT_ACTION]

export const TRANSFER_SORT_FIELD = {
  NAME: 'name',
  CREATED_AT: 'createdAt',
  STATUS: 'status',
  REMAINING_TIME: 'remainingTime',
} as const

export type TransferSortField = (typeof TRANSFER_SORT_FIELD)[keyof typeof TRANSFER_SORT_FIELD]

export const SIDEBAR_VIEW = {
  CONNECTIONS: 'connections',
  TRANSFERS: 'transfers',
} as const

export type SidebarView = (typeof SIDEBAR_VIEW)[keyof typeof SIDEBAR_VIEW]

export const UPLOAD_OPERATION_TYPE = {
  MKDIR: 'mkdir',
  UPLOAD: 'upload',
} as const

export type UploadOperationType = (typeof UPLOAD_OPERATION_TYPE)[keyof typeof UPLOAD_OPERATION_TYPE]

export const UPLOAD_OPERATION_STATUS = {
  WAITING: 'waiting',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type UploadOperationStatus =
  (typeof UPLOAD_OPERATION_STATUS)[keyof typeof UPLOAD_OPERATION_STATUS]

export const TRANSFER_CONFIG = {
  PROGRESS_THROTTLE_MS: 500,
  ROTATION_INTERVAL_MS: 3000,
  DEFAULT_MAX_CONCURRENCY: 5,
  MIN_CONCURRENCY: 1,
  MAX_CONCURRENCY: 10,
  MAX_INLINE_OPERATIONS: 3,
} as const

export type TransferConfigKey = (typeof TRANSFER_CONFIG)[keyof typeof TRANSFER_CONFIG]
