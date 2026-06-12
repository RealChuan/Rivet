import type React from 'react'
import { Info, RotateCcw, Trash, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OperationProgressInfo, TransferTask } from '@shared/types/transfer.js'
import { FileIcon } from '@renderer/components/common/index.js'
import { useTransferStore } from '@renderer/features/transfer/stores/transfer.js'
import { useClickOutside } from '@renderer/hooks/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import {
  TRANSFER_CONFIG,
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
} from '@shared/constants/transfer.js'
import { formatFileSize } from '@shared/utils/index.js'
import { TransferProgressBar } from './TransferProgressBar.js'

const EMPTY_OPERATIONS: OperationProgressInfo[] = []

// Grid columns: [name 1fr] [size 7rem] [progress 7rem] [speed 4rem] [time 3rem] [actions 2rem]
// Fixed 2rem for actions ensures alignment between main rows (with button) and sub-rows (empty)
const GRID_COLS = 'grid grid-cols-[1fr_7rem_7rem_4rem_3rem_2rem] gap-x-2'
// Sub-row grid: adds a 1.25rem indent column before name — fixed columns still align with main row
const SUB_GRID_COLS = 'grid grid-cols-[1.25rem_1fr_7rem_7rem_4rem_3rem_2rem] gap-x-2'

function formatRemainingTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m${s}s`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h${m}m`
}

function computeRemainingSeconds(task: TransferTask): number {
  const speed = task.speed ?? 0
  if (speed <= 0 || task.fileSize <= 0) return Infinity
  const remaining = task.fileSize - task.transferredSize
  if (remaining <= 0) return 0
  return remaining / speed
}

function formatSpeed(bytesPerSecond: number, lng: string): string {
  if (bytesPerSecond <= 0) return '-'
  return `${formatFileSize(bytesPerSecond, lng)}/s`
}

function computeOpRemainingSeconds(op: OperationProgressInfo): number {
  const speed = op.speed ?? 0
  const total = op.fileSize ?? 0
  if (speed <= 0 || total <= 0) return Infinity
  const remaining = total - op.transferredSize
  if (remaining <= 0) return 0
  return remaining / speed
}

interface InlineOperationRowProps {
  op: OperationProgressInfo
  lng: string
}

const InlineOperationRow: React.FC<InlineOperationRowProps> = ({ op, lng }) => {
  const { t } = useTranslation()
  const isMkdir = op.type === TRANSFER_OPERATION_TYPE.MKDIR

  const isFailed = op.status === OPERATION_STATUS.FAILED
  const isRunning = op.status === OPERATION_STATUS.RUNNING
  const isCompleted = op.status === OPERATION_STATUS.COMPLETED
  const isWaiting = op.status === OPERATION_STATUS.WAITING || isMkdir

  return (
    <div className={`${SUB_GRID_COLS} items-center h-8 px-3 text-xs`}>
      {/* Indent spacer column */}
      <div />

      {/* Name column */}
      <div className="flex items-center gap-2 min-w-0">
        <FileIcon
          type={isMkdir ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE}
          className="w-4 h-4 shrink-0"
        />
        <span className="truncate">{op.itemName}</span>
      </div>

      {/* Size column */}
      <span className="tabular-nums text-right whitespace-nowrap">
        {!isWaiting && !isFailed
          ? isCompleted
            ? op.fileSize !== undefined && op.fileSize > 0
              ? formatFileSize(op.fileSize, lng)
              : null
            : `${formatFileSize(op.transferredSize, lng)}/${formatFileSize(op.fileSize ?? 0, lng)}`
          : null}
      </span>

      {/* Progress column */}
      <div>
        {isFailed ? (
          <TransferProgressBar
            transferred={op.transferredSize}
            total={op.fileSize ?? 0}
            status={OPERATION_STATUS.FAILED}
          />
        ) : (
          <TransferProgressBar
            transferred={isCompleted ? (op.fileSize ?? 0) : op.transferredSize}
            total={op.fileSize ?? 0}
            status={op.status}
          />
        )}
      </div>

      {/* Speed column — empty for sub-rows */}
      <span />

      {/* Time/status column */}
      <span
        className={`whitespace-nowrap text-right ${isFailed ? 'text-danger' : 'text-text-muted tabular-nums'}`}
      >
        {isFailed
          ? t('transfer.status.failed')
          : isWaiting
            ? t('transfer.status.waiting')
            : isRunning
              ? formatRemainingTime(computeOpRemainingSeconds(op))
              : null}
      </span>

      {/* Actions column — empty for sub-rows */}
      <span />
    </div>
  )
}

interface ContextMenuState {
  x: number
  y: number
  taskId: string
  taskStatus: string
}

interface TransferTaskItemProps {
  task: TransferTask
  onRetry?: (taskId: string) => void
  onCancel?: (taskId: string) => void
  onRemove?: (taskId: string) => void
  style?: React.CSSProperties
}

export const TransferTaskItem: React.FC<TransferTaskItemProps> = ({
  task,
  onRetry,
  onCancel,
  onRemove,
  style,
}) => {
  const { t, i18n } = useTranslation()
  const lng = i18n.language
  const activeOperations = useTransferStore(
    state => state.activeOperations.get(task.id) ?? EMPTY_OPERATIONS
  )
  const progress = useTransferStore(state => state.taskProgress.get(task.id))
  const [rotationOffset, setRotationOffset] = useState(0)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [showErrorDetail, setShowErrorDetail] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const isFolder = task.itemType === FILE_TYPE.DIRECTORY
  const isFailed = task.status === OPERATION_STATUS.FAILED
  const isRunning = task.status === OPERATION_STATUS.RUNNING
  const isWaiting = task.status === OPERATION_STATUS.WAITING

  const transferredSize = progress?.transferredSize ?? task.transferredSize
  const fileSize = progress?.fileSize ?? task.fileSize
  const speed = progress?.speed ?? task.speed ?? 0
  const completedFileCount = progress?.completedFileCount ?? task.completedFileCount
  const totalFileCount = progress?.totalFileCount ?? task.totalFileCount

  const remainingSeconds = computeRemainingSeconds({
    ...task,
    transferredSize,
    fileSize,
    speed,
  })

  const shouldRotate = activeOperations.length > TRANSFER_CONFIG.MAX_INLINE_OPERATIONS

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
      setRotationOffset(prev => (prev + 1) % activeOperations.length)
    }, TRANSFER_CONFIG.ROTATION_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [shouldRotate, activeOperations.length])

  const displayedOps = shouldRotate
    ? Array.from({ length: TRANSFER_CONFIG.MAX_INLINE_OPERATIONS }, (_, i) => {
        const idx = (rotationOffset + i) % activeOperations.length
        return activeOperations[idx]
      })
    : activeOperations.slice(0, TRANSFER_CONFIG.MAX_INLINE_OPERATIONS)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id, taskStatus: task.status })
  }

  useClickOutside({
    ref: menuRef,
    enabled: !!contextMenu,
    onOutside: () => setContextMenu(null),
  })

  const errorText =
    isFailed && task.errorMessage
      ? task.errorMessage.length > 30
        ? `${task.errorMessage.slice(0, 30)}...`
        : task.errorMessage
      : null

  const clampPosition = (x: number, y: number) => {
    const menuWidth = 140
    const menuHeight = (isFailed ? 1 : 0) + (isRunning || isWaiting ? 1 : 0) + (isFailed ? 1 : 0)
    const itemHeight = 36
    const maxX = window.innerWidth - menuWidth - 8
    const maxY = window.innerHeight - menuHeight * itemHeight - 8
    return { left: Math.min(x, maxX), top: Math.min(y, maxY) }
  }

  // Folder status text: show file count or running
  const folderStatusText = isFailed
    ? t('transfer.status.failed')
    : isWaiting
      ? t('transfer.status.waiting')
      : totalFileCount
        ? t('transfer.folderStats.fileCount', {
            completed: completedFileCount ?? 0,
            total: totalFileCount,
          })
        : t('transfer.status.running')

  return (
    <div style={style} className="overflow-hidden">
      <div
        className={`${GRID_COLS} items-center h-10 px-3 hover:bg-hover transition-colors cursor-default border-b border-border group`}
        onContextMenu={handleContextMenu}
        data-transfer-task={task.id}
      >
        {/* Name column */}
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon
            type={isFolder ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE}
            className="w-4 h-4 shrink-0"
          />
          <span className="truncate text-sm" title={`${task.localPath} → ${task.remotePath}`}>
            {task.itemName}
          </span>
        </div>

        {/* Size column */}
        {isFailed && errorText ? (
          <span className="text-danger text-xs truncate" title={task.errorMessage}>
            {errorText}
          </span>
        ) : isFolder ? (
          <span className="text-text-muted text-xs tabular-nums text-right whitespace-nowrap">
            {folderStatusText}
          </span>
        ) : (
          <span className="text-text-muted text-xs tabular-nums text-right whitespace-nowrap">
            {formatFileSize(transferredSize, lng)}/{formatFileSize(fileSize, lng)}
          </span>
        )}

        {/* Progress column */}
        <div>
          {!isFolder && !isFailed && (
            <TransferProgressBar
              transferred={transferredSize}
              total={fileSize}
              status={task.status}
            />
          )}
        </div>

        {/* Speed column */}
        <span className="text-text-muted text-xs tabular-nums text-right whitespace-nowrap">
          {!isFolder && !isFailed && (isRunning || isWaiting) ? formatSpeed(speed, lng) : ''}
        </span>

        {/* Time/status column */}
        <span className="text-text-muted text-xs tabular-nums text-right whitespace-nowrap">
          {isFailed
            ? t('transfer.status.failed')
            : isWaiting
              ? t('transfer.status.waiting')
              : isFolder
                ? ''
                : formatRemainingTime(remainingSeconds)}
        </span>

        {/* Actions column */}
        <div className="flex items-center justify-end">
          {(isRunning || isWaiting) && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onCancel?.(task.id)
              }}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-none cursor-pointer text-text-muted hover:text-danger hover:bg-danger-light transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              aria-label={t('transfer.action.cancel')}
            >
              <X />
            </button>
          )}
          {isFailed && (
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                onRemove?.(task.id)
              }}
              className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-none cursor-pointer text-text-muted hover:text-text hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              aria-label={t('transfer.action.remove')}
            >
              <X />
            </button>
          )}
        </div>
      </div>

      {isFolder &&
        displayedOps.map(op => (op ? <InlineOperationRow key={op.id} op={op} lng={lng} /> : null))}

      {contextMenu && (
        <div
          ref={menuRef}
          className="fixed bg-bg rounded-lg shadow-dropdown border border-border p-1 min-w-35 z-9999 animate-menu-in"
          style={clampPosition(contextMenu.x, contextMenu.y)}
        >
          {isFailed && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-text bg-transparent border-none rounded-md cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              onClick={() => {
                onRetry?.(contextMenu.taskId)
                setContextMenu(null)
              }}
            >
              <RotateCcw />
              {t('transfer.action.retry')}
            </button>
          )}
          {isFailed && task.errorMessage && (
            <button
              type="button"
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-muted hover:bg-hover transition-colors cursor-default focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              onClick={() => {
                setShowErrorDetail(true)
                setContextMenu(null)
              }}
            >
              <Info className="w-3.5 h-3.5" />
              {t('transfer.action.viewErrorDetails')}
            </button>
          )}
          {(isRunning || isWaiting) && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-danger bg-transparent border-none rounded-md cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              onClick={() => {
                onCancel?.(contextMenu.taskId)
                setContextMenu(null)
              }}
            >
              <X />
              {t('transfer.action.cancel')}
            </button>
          )}
          {isFailed && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-text-muted bg-transparent border-none rounded-md cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              onClick={() => {
                onRemove?.(contextMenu.taskId)
                setContextMenu(null)
              }}
            >
              <Trash />
              {t('transfer.action.remove')}
            </button>
          )}
        </div>
      )}

      {showErrorDetail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowErrorDetail(false)}
        >
          <div
            className="bg-surface rounded-lg shadow-lg p-4 max-w-md w-full mx-4"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-sm font-medium text-text mb-2">
              {t('transfer.action.viewErrorDetails')}
            </h3>
            <p className="text-sm text-text-muted break-all whitespace-pre-wrap">
              {task.errorMessage}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-sm bg-transparent border border-border text-text-muted hover:bg-hover transition-colors cursor-default"
                onClick={() => {
                  void navigator.clipboard.writeText(task.errorMessage ?? '')
                }}
              >
                {t('transfer.errorDetail.copy')}
              </button>
              <button
                type="button"
                className="px-3 py-1.5 rounded-md text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-default"
                onClick={() => setShowErrorDetail(false)}
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
