export const OPERATION_STATUS = {
  WAITING: 'waiting',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const

export type OperationStatus = (typeof OPERATION_STATUS)[keyof typeof OPERATION_STATUS]

export const TRANSFER_DIRECTION = {
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
} as const

export type TransferDirection = (typeof TRANSFER_DIRECTION)[keyof typeof TRANSFER_DIRECTION]

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

export const TRANSFER_OPERATION_TYPE = {
  MKDIR: 'mkdir',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
} as const

export type TransferOperationType =
  (typeof TRANSFER_OPERATION_TYPE)[keyof typeof TRANSFER_OPERATION_TYPE]

export const TRANSFER_CONFIG = {
  PROGRESS_THROTTLE_MS: 500,
  ROTATION_INTERVAL_MS: 3000,
  DEFAULT_CONCURRENCY: 5,
  MIN_CONCURRENCY: 1,
  MAX_CONCURRENCY: 10,
  MAX_INLINE_OPERATIONS: 3,
} as const

export const LAST_DIR_KEY = {
  UPLOAD: 'lastUploadDir',
  DOWNLOAD: 'lastDownloadDir',
} as const

export type LastDirKey = (typeof LAST_DIR_KEY)[keyof typeof LAST_DIR_KEY]
