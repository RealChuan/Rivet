import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { OperationProgressInfo, TransferTask } from '@shared/types/transfer.js'
import FileIcon from '@renderer/components/common/FileIcon.js'
import { RetryIcon } from '@renderer/components/common/RetryIcon.js'
import { TrashIcon } from '@renderer/components/common/TrashIcon.js'
import { XIcon } from '@renderer/components/common/XIcon.js'
import { useTransferStore } from '@renderer/features/transfer/stores/transfer.js'
import {
  TRANSFER_CONFIG,
  TRANSFER_ITEM_TYPE,
  TRANSFER_TASK_STATUS,
  UPLOAD_OPERATION_STATUS,
  UPLOAD_OPERATION_TYPE,
} from '@shared/constants/transfer.js'
import { formatFileSize } from '@shared/utils/index.js'
import { TransferProgressBar } from './TransferProgressBar.js'

const EMPTY_OPERATIONS: OperationProgressInfo[] = []

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
  const isMkdir = op.type === UPLOAD_OPERATION_TYPE.MKDIR

  if (isMkdir) {
    return (
      <div className="flex items-center h-8 pl-8 pr-3 gap-3 text-xs">
        <FileIcon type="directory" className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate flex-1 min-w-0">{op.itemName}</span>
        <span className="text-text-muted shrink-0">{t('transfer.status.waiting')}</span>
      </div>
    )
  }

  const isFailed = (op.status as string) === UPLOAD_OPERATION_STATUS.FAILED
  const isRunning = (op.status as string) === UPLOAD_OPERATION_STATUS.RUNNING
  const isCompleted = (op.status as string) === UPLOAD_OPERATION_STATUS.COMPLETED

  if (isFailed) {
    return (
      <div className="flex items-center h-8 pl-8 pr-3 gap-3 text-xs">
        <FileIcon type="file" className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate flex-1 min-w-0">{op.itemName}</span>
        <span className="text-danger shrink-0">{t('transfer.status.failed')}</span>
      </div>
    )
  }

  if (isCompleted) {
    return (
      <div className="flex items-center h-8 pl-8 pr-3 gap-3 text-xs">
        <FileIcon type="file" className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate flex-1 min-w-0">{op.itemName}</span>
        {op.fileSize !== undefined && op.fileSize > 0 && (
          <span className="text-text-muted tabular-nums shrink-0 whitespace-nowrap w-28 text-right">
            {formatFileSize(op.fileSize, lng)}
          </span>
        )}
        <div className="w-24 shrink-0">
          <TransferProgressBar
            transferred={op.fileSize ?? 0}
            total={op.fileSize ?? 0}
            status={TRANSFER_TASK_STATUS.COMPLETED}
          />
        </div>
      </div>
    )
  }

  const remainingSeconds = computeOpRemainingSeconds(op)

  return (
    <div className="flex items-center h-8 pl-8 pr-3 gap-3 text-xs">
      <FileIcon type="file" className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate flex-1 min-w-0">{op.itemName}</span>
      <span className="text-text-muted tabular-nums shrink-0 whitespace-nowrap w-28 text-right">
        {formatFileSize(op.transferredSize, lng)}/{formatFileSize(op.fileSize ?? 0, lng)}
      </span>
      <div className="w-24 shrink-0">
        <TransferProgressBar
          transferred={op.transferredSize}
          total={op.fileSize ?? 0}
          status={TRANSFER_TASK_STATUS.RUNNING}
        />
      </div>
      {isRunning && (
        <span className="text-text-muted tabular-nums w-12 text-right shrink-0 whitespace-nowrap">
          {formatRemainingTime(remainingSeconds)}
        </span>
      )}
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
  const menuRef = useRef<HTMLDivElement>(null)

  const isFolder = task.itemType === TRANSFER_ITEM_TYPE.FOLDER
  const isFailed = task.status === TRANSFER_TASK_STATUS.FAILED
  const isRunning = task.status === TRANSFER_TASK_STATUS.RUNNING
  const isWaiting = task.status === TRANSFER_TASK_STATUS.WAITING

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

  const statusText = isFailed
    ? t('transfer.status.failed')
    : isWaiting
      ? t('transfer.status.waiting')
      : formatRemainingTime(remainingSeconds)

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

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY, taskId: task.id, taskStatus: task.status })
    },
    [task.id, task.status]
  )

  useEffect(() => {
    if (!contextMenu) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [contextMenu])

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
    return { x: Math.min(x, maxX), y: Math.min(y, maxY) }
  }

  return (
    <div style={style} className="overflow-hidden">
      <div
        className="flex items-center h-10 px-3 gap-2 hover:bg-hover transition-colors cursor-default border-b border-border group"
        onContextMenu={handleContextMenu}
        data-transfer-task={task.id}
      >
        <FileIcon type={isFolder ? 'directory' : 'file'} className="w-4 h-4 shrink-0" />
        <span
          className="truncate flex-1 min-w-0 text-sm"
          title={`${task.localPath} → ${task.remotePath}`}
        >
          {task.itemName}
        </span>

        {isFailed && errorText ? (
          <span
            className="text-danger text-xs truncate max-w-40 shrink-0"
            title={task.errorMessage}
          >
            {errorText}
          </span>
        ) : isFolder ? (
          <span className="text-text-muted text-xs tabular-nums shrink-0 whitespace-nowrap">
            {t('transfer.folderStats.fileCount', {
              completed: completedFileCount ?? 0,
              total: totalFileCount ?? 0,
            })}
          </span>
        ) : (
          <>
            <span className="text-text-muted text-xs tabular-nums shrink-0 whitespace-nowrap">
              {formatFileSize(transferredSize, lng)}/{formatFileSize(fileSize, lng)}
            </span>
            <div className="w-28 shrink-0">
              <TransferProgressBar
                transferred={transferredSize}
                total={fileSize}
                status={task.status}
              />
            </div>
            {(isRunning || isWaiting) && (
              <span className="text-text-muted text-xs tabular-nums w-16 text-right shrink-0 whitespace-nowrap">
                {formatSpeed(speed, lng)}
              </span>
            )}
          </>
        )}

        <span className="text-text-muted text-xs tabular-nums w-12 text-right shrink-0 whitespace-nowrap">
          {statusText}
        </span>

        {(isRunning || isWaiting) && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onCancel?.(task.id)
            }}
            className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-none cursor-pointer text-text-muted hover:text-danger hover:bg-danger-light transition-colors shrink-0"
            aria-label={t('transfer.action.cancel')}
          >
            <XIcon />
          </button>
        )}

        {isFailed && (
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onRemove?.(task.id)
            }}
            className="w-6 h-6 rounded-md flex items-center justify-center bg-transparent border-none cursor-pointer text-text-muted hover:text-text hover:bg-hover transition-colors shrink-0"
            aria-label={t('transfer.action.remove')}
          >
            <XIcon />
          </button>
        )}
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
              className="w-full px-3 py-2 text-left text-sm text-text bg-transparent border-none rounded-md cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors"
              onClick={() => {
                onRetry?.(contextMenu.taskId)
                setContextMenu(null)
              }}
            >
              <RetryIcon />
              {t('transfer.action.retry')}
            </button>
          )}
          {(isRunning || isWaiting) && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-danger bg-transparent border-none rounded-md cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors"
              onClick={() => {
                onCancel?.(contextMenu.taskId)
                setContextMenu(null)
              }}
            >
              <XIcon />
              {t('transfer.action.cancel')}
            </button>
          )}
          {isFailed && (
            <button
              type="button"
              className="w-full px-3 py-2 text-left text-sm text-text-muted bg-transparent border-none rounded-md cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors"
              onClick={() => {
                onRemove?.(contextMenu.taskId)
                setContextMenu(null)
              }}
            >
              <TrashIcon />
              {t('transfer.action.remove')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
