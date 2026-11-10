import type React from 'react'
import { ChevronRight, Info, Pause, Play, RotateCcw, Trash, X } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { OperationProgressInfo, TransferTask } from '@shared/types/transfer.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import {
  TRANSFER_CONFIG,
  OPERATION_STATUS,
  TRANSFER_DIRECTION,
  TRANSFER_OPERATION_TYPE,
} from '@shared/constants/transfer.js'
import { formatFileSize } from '@shared/utils/index.js'
import { FileIcon } from '../../../components/common/index.js'
import { cn } from '../../../utils/index.js'
import { useTransferStore } from '../stores/transfer.js'
import { computeRemainingSeconds, formatRemainingTime, formatSpeed } from '../utils/format.js'
import { ErrorDetailDialog } from './ErrorDetailDialog.js'
import { TransferProgressBar } from './TransferProgressBar.js'

const EMPTY_OPERATIONS: OperationProgressInfo[] = []

export const QUEUE_ROW_HEIGHT = 34
export const QUEUE_ROW_BORDER = 1
/** 两行路径：2 × 20px，行高由 leading-5 决定。 */
export const QUEUE_PATH_BLOCK_HEIGHT = 40
/** 详情块上下内边距：pt-1 + pb-2。 */
export const QUEUE_DETAIL_PADDING = 12
export const QUEUE_OPERATION_ROW_HEIGHT = 28

// [名称 1fr] [大小 9rem] [进度 6.5rem] [速度 4.5rem] [剩余 3.5rem] [操作 3.5rem]
// 除名称列外都按内容给足宽度，名称列用剩余空间：宁可截断名称，也不截断数据。
// 操作列按两个 24px 按钮（暂停 + 取消）留位，挤成 2rem 会让图标互相压边。
const GRID_COLS = 'grid grid-cols-[minmax(0,1fr)_9rem_6.5rem_4.5rem_3.5rem_3.5rem] gap-x-3'
const SUB_GRID_COLS =
  'grid grid-cols-[1.25rem_minmax(0,1fr)_9rem_6.5rem_4.5rem_3.5rem_3.5rem] gap-x-3'

interface InlineOperationRowProps {
  op: OperationProgressInfo
  lng: string
}

const InlineOperationRow = ({ op, lng }: InlineOperationRowProps) => {
  const { t } = useTranslation()
  const isMkdir = op.type === TRANSFER_OPERATION_TYPE.MKDIR
  const isFailed = op.status === OPERATION_STATUS.FAILED
  const isRunning = op.status === OPERATION_STATUS.RUNNING
  const isCompleted = op.status === OPERATION_STATUS.COMPLETED
  const isWaiting = op.status === OPERATION_STATUS.WAITING || isMkdir

  const sizeText =
    isWaiting || isFailed
      ? null
      : isCompleted
        ? op.fileSize !== undefined && op.fileSize > 0
          ? formatFileSize(op.fileSize, lng)
          : null
        : `${formatFileSize(op.transferredSize, lng)}/${formatFileSize(op.fileSize ?? 0, lng)}`

  const remainingText = isFailed
    ? t(($) => $.transfer.status.failed)
    : isWaiting
      ? t(($) => $.transfer.status.waiting)
      : isRunning && (op.speed ?? 0) > 0
        ? formatRemainingTime(
            computeRemainingSeconds(op.transferredSize, op.fileSize ?? 0, op.speed ?? 0),
          )
        : null

  return (
    <div className={`${SUB_GRID_COLS} items-center h-7 px-0 text-xs`}>
      <div />

      <div className="flex items-center gap-2 min-w-0" title={op.itemName}>
        <FileIcon
          type={isMkdir ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE}
          name={op.itemName}
          className="w-3.5 h-3.5 shrink-0"
        />
        <span className="truncate">{op.itemName}</span>
      </div>

      <span className="tabular-nums text-right whitespace-nowrap" title={sizeText ?? undefined}>
        {sizeText}
      </span>

      <div>
        <TransferProgressBar
          transferred={isCompleted ? (op.fileSize ?? 0) : op.transferredSize}
          total={op.fileSize ?? 0}
          status={op.status}
          title={sizeText ?? undefined}
        />
      </div>

      <span />

      <span
        className={`whitespace-nowrap text-right ${isFailed ? 'text-danger' : 'text-text-muted tabular-nums'}`}
        title={remainingText ?? undefined}
      >
        {remainingText}
      </span>

      <span />
    </div>
  )
}

interface TransferTaskItemProps {
  task: TransferTask
  isExpanded: boolean
  onToggleExpand: (taskId: string) => void
  onRetry?: (taskId: string) => void
  onCancel?: (taskId: string) => void
  onRemove?: (taskId: string) => void
  onPause?: (taskId: string) => void
  onResume?: (taskId: string) => void
  style?: React.CSSProperties
}

export const TransferTaskItem = ({
  task,
  isExpanded,
  onToggleExpand,
  onRetry,
  onCancel,
  onRemove,
  onPause,
  onResume,
  style,
}: TransferTaskItemProps) => {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const activeOperations = useTransferStore(
    (state) => state.activeOperations.get(task.id) ?? EMPTY_OPERATIONS,
  )
  const progress = useTransferStore((state) => state.taskProgress.get(task.id))
  const [showErrorDetail, setShowErrorDetail] = useState(false)

  const isFolder = task.itemType === FILE_TYPE.DIRECTORY
  const isFailed = task.status === OPERATION_STATUS.FAILED
  const isRunning = task.status === OPERATION_STATUS.RUNNING
  const isWaiting = task.status === OPERATION_STATUS.WAITING
  const isPaused = task.status === OPERATION_STATUS.PAUSED
  // 只有下载能暂停；上传方向没有写偏移入口，暂停等于从头再来。
  const canPause = task.direction === TRANSFER_DIRECTION.DOWNLOAD && (isRunning || isWaiting)

  const transferredSize = progress?.transferredSize ?? task.transferredSize
  const fileSize = progress?.fileSize ?? task.fileSize
  const speed = progress?.speed ?? task.speed ?? 0
  const completedFileCount = progress?.completedFileCount ?? task.completedFileCount
  const totalFileCount = progress?.totalFileCount ?? task.totalFileCount

  const remainingSeconds = computeRemainingSeconds(transferredSize, fileSize, speed)

  // 只展示前 N 条；主进程本来就只发 N 条，不做轮播（轮播会让整块行每 3s 集体换位）。
  const displayedOps = activeOperations.slice(0, TRANSFER_CONFIG.MAX_INLINE_OPERATIONS)

  const scanCompleted = progress?.scanCompleted ?? task.scanCompleted ?? false

  // 文件夹的 fileSize 扫描期是“已发现字节”，扫描结束后才是总量；两种都按 已完成/总数 显示。
  const bytesText = `${formatFileSize(transferredSize, lng)}/${formatFileSize(fileSize, lng)}`
  // 每格都配 title：列宽按数据让位，长串截断后靠 hover 看全。
  const speedText = !isFailed && (isRunning || isWaiting) ? formatSpeed(speed, lng) : ''

  // 扫描期间 total 只是已发现数；计数列始终用同一种紧凑格式，扫描状态交给剩余列。
  const folderCountText = t(($) => $.transfer.folderStats.fileCount, {
    completed: completedFileCount ?? 0,
    total: totalFileCount ?? 0,
  })

  // 文件夹的字节总量扫描结束才是真值，之前算出来的剩余时间会偏小。
  const statusText = isFailed
    ? t(($) => $.transfer.status.failed)
    : isPaused
      ? t(($) => $.transfer.status.paused)
      : isWaiting
        ? t(($) => $.transfer.status.waiting)
        : isFolder
          ? scanCompleted
            ? formatRemainingTime(remainingSeconds)
            : t(($) => $.transfer.status.scanning)
          : formatRemainingTime(remainingSeconds)

  const menuItemClass = cn(
    'w-full px-3 py-2 text-left text-sm bg-transparent border-none rounded-md',
    'flex items-center gap-2 transition-colors',
    'data-highlighted:bg-hover data-highlighted:outline-none',
  )

  return (
    <div style={style} className="overflow-hidden border-b border-border">
      <ContextMenuPrimitive.Root>
        <ContextMenuPrimitive.Trigger asChild>
          <div
            className={`${GRID_COLS} items-center h-8.5 px-3 hover:bg-hover transition-colors cursor-default group`}
            data-transfer-task={task.id}
          >
            <button
              type="button"
              onClick={() => onToggleExpand(task.id)}
              aria-expanded={isExpanded}
              aria-label={task.itemName}
              className="flex items-center gap-1.5 min-w-0 bg-transparent border-none p-0 cursor-default text-left focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 rounded-sm"
            >
              <ChevronRight
                className={cn(
                  'w-3 h-3 shrink-0 text-text-muted transition-transform duration-150',
                  isExpanded && 'rotate-90',
                )}
              />
              <FileIcon
                type={isFolder ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE}
                name={task.itemName}
                className="w-4 h-4 shrink-0"
              />
              <span className="truncate text-sm" title={task.itemName}>
                {task.itemName}
              </span>
            </button>

            {isFolder ? (
              // 文件夹的字节总量扫描期只增不减，画进度条会倒退；字节放大小列、文件计数放进度列。
              isFailed ? (
                <span
                  className="col-span-2 text-xs tabular-nums text-right whitespace-nowrap truncate text-danger"
                  title={task.errorMessage}
                >
                  {task.errorMessage ?? '-'}
                </span>
              ) : (
                <>
                  <span
                    className="text-xs tabular-nums text-right whitespace-nowrap truncate text-text-muted"
                    title={bytesText}
                  >
                    {bytesText}
                  </span>
                  <span
                    className="text-xs tabular-nums text-right whitespace-nowrap truncate text-text-muted"
                    title={folderCountText}
                  >
                    {folderCountText}
                  </span>
                </>
              )
            ) : (
              <>
                <span
                  className="text-xs tabular-nums text-right whitespace-nowrap truncate text-text-muted"
                  title={bytesText}
                >
                  {bytesText}
                </span>
                <div>
                  <TransferProgressBar
                    transferred={transferredSize}
                    total={fileSize}
                    status={task.status}
                    title={bytesText}
                  />
                </div>
              </>
            )}

            <span
              className="text-text-muted text-xs tabular-nums text-right whitespace-nowrap"
              title={speedText || undefined}
            >
              {speedText}
            </span>

            <span
              className={cn(
                'text-xs tabular-nums text-right whitespace-nowrap',
                isFailed ? 'text-danger' : 'text-text-muted',
              )}
              title={statusText || undefined}
            >
              {statusText}
            </span>

            <div className="flex items-center justify-end gap-0.5">
              {canPause && (
                <button
                  type="button"
                  onClick={() => onPause?.(task.id)}
                  className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center bg-transparent border-none text-text-muted hover:text-text hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
                  aria-label={t(($) => $.transfer.action.pause)}
                >
                  <Pause className="w-4.5 h-4.5" />
                </button>
              )}
              {isPaused && (
                <button
                  type="button"
                  onClick={() => onResume?.(task.id)}
                  className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center bg-transparent border-none text-text-muted hover:text-accent hover:bg-selected transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
                  aria-label={t(($) => $.transfer.action.resume)}
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
              {(isRunning || isWaiting || isPaused) && (
                <button
                  type="button"
                  onClick={() => onCancel?.(task.id)}
                  className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-none text-text-muted hover:text-danger hover:bg-danger-light transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
                  aria-label={t(($) => $.transfer.action.cancel)}
                >
                  <X />
                </button>
              )}
              {isFailed && (
                <button
                  type="button"
                  onClick={() => onRemove?.(task.id)}
                  className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-none text-text-muted hover:text-text hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
                  aria-label={t(($) => $.transfer.action.remove)}
                >
                  <X />
                </button>
              )}
            </div>
          </div>
        </ContextMenuPrimitive.Trigger>
        <ContextMenuPrimitive.Portal>
          <ContextMenuPrimitive.Content className="bg-glass-bg rounded-lg shadow-dropdown border border-glass-border p-1 min-w-35 z-9999 animate-menu-in">
            {isFailed && (
              <ContextMenuPrimitive.Item
                className={menuItemClass}
                onSelect={() => onRetry?.(task.id)}
              >
                <RotateCcw />
                {t(($) => $.transfer.action.retry)}
              </ContextMenuPrimitive.Item>
            )}
            {isFailed && task.errorMessage && (
              <ContextMenuPrimitive.Item
                className={cn(menuItemClass, 'text-text-muted cursor-default')}
                onSelect={() => setShowErrorDetail(true)}
              >
                <Info className="w-3.5 h-3.5" />
                {t(($) => $.transfer.action.viewErrorDetails)}
              </ContextMenuPrimitive.Item>
            )}
            {canPause && (
              <ContextMenuPrimitive.Item
                className={menuItemClass}
                onSelect={() => onPause?.(task.id)}
              >
                <Pause />
                {t(($) => $.transfer.action.pause)}
              </ContextMenuPrimitive.Item>
            )}
            {isPaused && (
              <ContextMenuPrimitive.Item
                className={menuItemClass}
                onSelect={() => onResume?.(task.id)}
              >
                <Play />
                {t(($) => $.transfer.action.resume)}
              </ContextMenuPrimitive.Item>
            )}
            {(isRunning || isWaiting || isPaused) && (
              <ContextMenuPrimitive.Item
                className={cn(menuItemClass, 'text-danger')}
                onSelect={() => onCancel?.(task.id)}
              >
                <X />
                {t(($) => $.transfer.action.cancel)}
              </ContextMenuPrimitive.Item>
            )}
            {isFailed && (
              <ContextMenuPrimitive.Item
                className={cn(menuItemClass, 'text-text-muted')}
                onSelect={() => onRemove?.(task.id)}
              >
                <Trash />
                {t(($) => $.transfer.action.remove)}
              </ContextMenuPrimitive.Item>
            )}
          </ContextMenuPrimitive.Content>
        </ContextMenuPrimitive.Portal>
      </ContextMenuPrimitive.Root>

      {(isFolder || isExpanded) && (
        <div className="px-3 pb-2 pt-1">
          {isExpanded && (
            <>
              <div
                className="text-xs text-text-secondary truncate leading-5"
                title={task.localPath}
              >
                <span className="text-text-muted mr-1.5">{t(($) => $.transfer.path.source)}: </span>
                {task.localPath}
              </div>
              <div
                className="text-xs text-text-secondary truncate leading-5"
                title={task.remotePath}
              >
                <span className="text-text-muted mr-1.5">
                  {t(($) => $.transfer.path.destination)}:{' '}
                </span>
                {task.remotePath}
              </div>
            </>
          )}
          {/* 子文件默认展示，不随展开状态隐藏。 */}
          {isFolder &&
            displayedOps.map((op) =>
              op ? <InlineOperationRow key={op.id} op={op} lng={lng} /> : null,
            )}
        </div>
      )}

      <ErrorDetailDialog
        open={showErrorDetail}
        onClose={() => setShowErrorDetail(false)}
        errorMessage={task.errorMessage ?? ''}
      />
    </div>
  )
}
