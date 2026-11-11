export const OPERATION_STATUS = {
  WAITING: 'waiting',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  /** 用户暂停：任务留在列表里，凭本地半成品继续（当前仅支持下载）。 */
  PAUSED: 'paused',
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

/** 传输队列面板的三态；`hidden` 由任务列表为空推导，不占状态。 */
export const QUEUE_PANEL_MODE = {
  COLLAPSED: 'collapsed',
  EXPANDED: 'expanded',
  MAXIMIZED: 'maximized',
} as const

export type QueuePanelMode = (typeof QUEUE_PANEL_MODE)[keyof typeof QUEUE_PANEL_MODE]

/** 队列面板的任务范围：只看当前连接，还是全部连接。 */
export const TRANSFER_SCOPE = {
  CURRENT: 'current',
  ALL: 'all',
} as const

export type TransferScope = (typeof TRANSFER_SCOPE)[keyof typeof TRANSFER_SCOPE]

export const TRANSFER_OPERATION_TYPE = {
  MKDIR: 'mkdir',
  UPLOAD: 'upload',
  DOWNLOAD: 'download',
} as const

export type TransferOperationType =
  (typeof TRANSFER_OPERATION_TYPE)[keyof typeof TRANSFER_OPERATION_TYPE]

export const TRANSFER_CONFIG = {
  /** 单文件分块进度合并窗口；与主进程聚合窗口同量级，避免高频 IPC 之外的重复计算。 */
  PROGRESS_THROTTLE_MS: 200,
  DEFAULT_CONCURRENCY: 5,
  MIN_CONCURRENCY: 1,
  MAX_CONCURRENCY: 10,
  MAX_INLINE_OPERATIONS: 3,
  /** 目录扫描期允许并行的远端 mkdir/list 数量；扫描不应阻塞已发现文件的传输。 */
  FOLDER_SCAN_CONCURRENCY: 4,
  /** 扫描期为本地文件补 size 的并行 stat 数量。 */
  FOLDER_STAT_CONCURRENCY: 8,
  /**
   * 文件夹排队窗口 = 当前方向并发 × 该系数。并发 5 时排队 50 个；
   * 传输能力就这么点，堆更多只会白占内存，也没法更早传完。
   */
  FOLDER_QUEUE_CONCURRENCY_FACTOR: 10,
  /** 目录预取窗口：队列短时才提前发起 mkdir/list，避免宽目录挂出成千上万个等待者。 */
  FOLDER_SCAN_PREFETCH: 64,
  /** 限速以字节/秒存储，`0` 表示不限速。 */
  MIN_SPEED_LIMIT: 0,
  /** 1 GiB/s，够跑满万兆链路。 */
  MAX_SPEED_LIMIT: 1024 * 1024 * 1024,
  DEFAULT_SPEED_LIMIT: 0,
} as const

/** 主进程进度聚合窗口：同一 task 在窗口内只保留最后一条快照。 */
export const PROGRESS_BATCH_MS = 200

/** 失败任务历史上限；超出按 createdAt 淘汰最旧的。 */
export const MAX_FINISHED_TASKS = 500

export const LAST_DIR_KEY = {
  UPLOAD: 'lastUploadDir',
  DOWNLOAD: 'lastDownloadDir',
} as const

export type LastDirKey = (typeof LAST_DIR_KEY)[keyof typeof LAST_DIR_KEY]
