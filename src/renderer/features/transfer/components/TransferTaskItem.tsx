import type React from 'react'
import { ChevronRight, Info, RotateCcw, Trash, X } from 'lucide-react'
import { ContextMenu as ContextMenuPrimitive } from 'radix-ui'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { OperationProgressInfo, TransferTask } from '@shared/types/transfer.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import {
  TRANSFER_CONFIG,
  OPERATION_STATUS,
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

// [名称 1fr] [大小 6.5rem] [进度 7rem] [速度 4.5rem] [剩余 3rem] [操作 2rem]
const GRID_COLS = 'grid grid-cols-[minmax(0,1fr)_6.5rem_7rem_4.5rem_3rem_2rem] gap-x-3'
const SUB_GRID_COLS = 'grid grid-cols-[1.25rem_minmax(0,1fr)_6.5rem_7rem_4.5rem_3rem_2rem] gap-x-3'

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

  return (
    <div className={`${SUB_GRID_COLS} items-center h-7 px-0 text-xs`}>
      <div />

      <div className="flex items-center gap-2 min-w-0">
        <FileIcon
          type={isMkdir ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE}
          name={op.itemName}
          className="w-3.5 h-3.5 shrink-0"
        />
        <span className="truncate">{op.itemName}</span>
      </div>

      <span className="tabular-nums text-right whitespace-nowrap">
        {!isWaiting && !isFailed
          ? isCompleted
            ? op.fileSize !== undefined && op.fileSize > 0
              ? formatFileSize(op.fileSize, lng)
              : null
            : `${formatFileSize(op.transferredSize, lng)}/${formatFileSize(op.fileSize ?? 0, lng)}`
          : null}
      </span>

      <div>
        <TransferProgressBar
          transferred={isCompleted ? (op.fileSize ?? 0) : op.transferredSize}
          total={op.fileSize ?? 0}
          status={op.status}
        />
      </div>

      <span />

      <span
        className={`whitespace-nowrap text-right ${isFailed ? 'text-danger' : 'text-text-muted tabular-nums'}`}
      >
        {isFailed
          ? t(($) => $.transfer.status.failed)
          : isWaiting
            ? t(($) => $.transfer.status.waiting)
            : isRunning && (op.speed ?? 0) > 0
              ? formatRemainingTime(
                  computeRemainingSeconds(op.transferredSize, op.fileSize ?? 0, op.speed ?? 0),
                )
              : null}
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
  style?: React.CSSProperties
}

export const TransferTaskItem = ({
  task,
  isExpanded,
  onToggleExpand,
  onRetry,
  onCancel,
  onRemove,
  style,
}: TransferTaskItemProps) => {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const activeOperations = useTransferStore(
    (state) => state.activeOperations.get(task.id) ?? EMPTY_OPERATIONS,
  )
  const progress = useTransferStore((state) => state.taskProgress.get(task.id))
  const [rotationOffset, setRotationOffset] = useState(0)
  const [showErrorDetail, setShowErrorDetail] = useState(false)

  const isFolder = task.itemType === FILE_TYPE.DIRECTORY
  const isFailed = task.status === OPERATION_STATUS.FAILED
  const isRunning = task.status === OPERATION_STATUS.RUNNING
  const isWaiting = task.status === OPERATION_STATUS.WAITING

  const transferredSize = progress?.transferredSize ?? task.transferredSize
  const fileSize = progress?.fileSize ?? task.fileSize
  const speed = progress?.speed ?? task.speed ?? 0
  const completedFileCount = progress?.completedFileCount ?? task.completedFileCount
  const totalFileCount = progress?.totalFileCount ?? task.totalFileCount

  const remainingSeconds = computeRemainingSeconds(transferredSize, fileSize, speed)

  const shouldRotate = isFolder && activeOperations.length > TRANSFER_CONFIG.MAX_INLINE_OPERATIONS

  const prevShouldRotate = useRef(shouldRotate)
  useEffect(() => {
    if (!shouldRotate && prevShouldRotate.current) {
      setRotationOffset(0)
    }
    prevShouldRotate.current = shouldRotate
  }, [shouldRotate])

  useEffect(() => {
    if (!shouldRotate) return
    const timer = setInterval(() => {
      setRotationOffset((prev) => (prev + 1) % activeOperations.length)
    }, TRANSFER_CONFIG.ROTATION_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [shouldRotate, activeOperations.length])

  const displayedOps = shouldRotate
    ? Array.from({ length: TRANSFER_CONFIG.MAX_INLINE_OPERATIONS }, (_, i) => {
        const idx = (rotationOffset + i) % activeOperations.length
        return activeOperations[idx]
      })
    : activeOperations.slice(0, TRANSFER_CONFIG.MAX_INLINE_OPERATIONS)

  const scanCompleted = progress?.scanCompleted ?? task.scanCompleted ?? false

  // 扫描期间 total 只是已发现数，不能当分母。
  const folderStatusText = isFailed
    ? t(($) => $.transfer.status.failed)
    : isWaiting
      ? t(($) => $.transfer.status.waiting)
      : scanCompleted
        ? t(($) => $.transfer.folderStats.fileCount, {
            completed: completedFileCount ?? 0,
            total: totalFileCount ?? 0,
          })
        : t(($) => $.transfer.folderStats.scanning, {
            completed: completedFileCount ?? 0,
            total: totalFileCount ?? 0,
          })

  const statusText = isFailed
    ? t(($) => $.transfer.status.failed)
    : isWaiting
      ? t(($) => $.transfer.status.waiting)
      : isFolder
        ? ''
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
              // 文件夹没有字节总量：文字占满大小+进度两列，不画进度条。
              <span
                className={cn(
                  'col-span-2 text-xs tabular-nums text-right whitespace-nowrap truncate',
                  isFailed ? 'text-danger' : 'text-text-muted',
                )}
                title={isFailed ? task.errorMessage : folderStatusText}
              >
                {isFailed ? (task.errorMessage ?? '-') : folderStatusText}
              </span>
            ) : (
              <>
                <span className="text-xs tabular-nums text-right whitespace-nowrap truncate text-text-muted">
                  {`${formatFileSize(transferredSize, lng)}/${formatFileSize(fileSize, lng)}`}
                </span>
                <div>
                  <TransferProgressBar
                    transferred={transferredSize}
                    total={fileSize}
                    status={task.status}
                  />
                </div>
              </>
            )}

            <span className="text-text-muted text-xs tabular-nums text-right whitespace-nowrap">
              {!isFailed && (isRunning || isWaiting) ? formatSpeed(speed, lng) : ''}
            </span>

            <span
              className={cn(
                'text-xs tabular-nums text-right whitespace-nowrap',
                isFailed ? 'text-danger' : 'text-text-muted',
              )}
            >
              {statusText}
            </span>

            <div className="flex items-center justify-end">
              {(isRunning || isWaiting) && (
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
            {(isRunning || isWaiting) && (
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
                className="text-[13px] text-text-secondary truncate leading-5"
                title={task.localPath}
              >
                <span className="text-text-muted mr-1.5">{t(($) => $.transfer.path.source)}: </span>
                {task.localPath}
              </div>
              <div
                className="text-[13px] text-text-secondary truncate leading-5"
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
