import type React from 'react'
import { useCallback, useMemo, useState } from 'react'
import type { TransferTask } from '@shared/types/transfer.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { OPERATION_STATUS, TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import { useTransferActions } from '../hooks/use-transfer-actions.js'
import {
  QUEUE_DETAIL_PADDING,
  QUEUE_OPERATION_ROW_HEIGHT,
  QUEUE_PATH_BLOCK_HEIGHT,
  QUEUE_ROW_BORDER,
  QUEUE_ROW_HEIGHT,
  TransferTaskItem,
} from './TransferTaskItem.js'
import { VirtualRows } from './VirtualRows.js'

export const QUEUE_GROUP_ROW_HEIGHT = 28

export type QueueRow =
  | {
      kind: 'group'
      sessionId: string
      name: string
      running: number
      failed: number
      total: number
    }
  | { kind: 'task'; task: TransferTask }

/** 按会话分组：保持传入顺序，组内顺序即排序结果。 */
export function buildQueueRows(
  tasks: TransferTask[],
  resolveSessionName: (sessionId: string) => string,
): QueueRow[] {
  const groups = new Map<string, QueueRow & { kind: 'group' }>()
  const rows: QueueRow[] = []

  for (const task of tasks) {
    const existing = groups.get(task.sessionId)
    if (existing) {
      existing.total++
      if (task.status === OPERATION_STATUS.FAILED) existing.failed++
      if (task.status === OPERATION_STATUS.RUNNING || task.status === OPERATION_STATUS.WAITING) {
        existing.running++
      }
    } else {
      const group: QueueRow & { kind: 'group' } = {
        kind: 'group',
        sessionId: task.sessionId,
        name: resolveSessionName(task.sessionId),
        running:
          task.status === OPERATION_STATUS.RUNNING || task.status === OPERATION_STATUS.WAITING
            ? 1
            : 0,
        failed: task.status === OPERATION_STATUS.FAILED ? 1 : 0,
        total: 1,
      }
      groups.set(task.sessionId, group)
      rows.push(group)
    }
    rows.push({ kind: 'task', task })
  }

  return rows
}

/** 行高只由行本身决定，不跟实时数据走；文件夹固定预留满额子文件行。 */
export function queueRowHeight(row: QueueRow | undefined, isExpanded: boolean): number {
  if (!row) return QUEUE_ROW_HEIGHT + QUEUE_ROW_BORDER
  if (row.kind === 'group') return QUEUE_GROUP_ROW_HEIGHT

  const isFolder = row.task.itemType === FILE_TYPE.DIRECTORY
  const operations = isFolder
    ? TRANSFER_CONFIG.MAX_INLINE_OPERATIONS * QUEUE_OPERATION_ROW_HEIGHT
    : 0
  const paths = isExpanded ? QUEUE_PATH_BLOCK_HEIGHT : 0
  const padding = isFolder || isExpanded ? QUEUE_DETAIL_PADDING : 0

  return QUEUE_ROW_HEIGHT + operations + paths + padding + QUEUE_ROW_BORDER
}

interface TransferListProps {
  tasks: TransferTask[]
  /** 跨会话时按连接分组。 */
  grouped: boolean
  resolveSessionName: (sessionId: string) => string
}

export const TransferList = ({ tasks, grouped, resolveSessionName }: TransferListProps) => {
  const { retryTask, cancelTask } = useTransferActions()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  // 展开会改变行高，虚拟化的测量缓存必须显式失效。
  const [measureRevision, setMeasureRevision] = useState(0)

  const rows = useMemo(
    () =>
      grouped
        ? buildQueueRows(tasks, resolveSessionName)
        : tasks.map((task) => ({ kind: 'task' as const, task })),
    [tasks, grouped, resolveSessionName],
  )

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
    setMeasureRevision((prev) => prev + 1)
  }, [])

  const handleRetry = useCallback(
    (taskId: string) => {
      void retryTask(taskId)
    },
    [retryTask],
  )

  const handleCancel = useCallback(
    (taskId: string) => {
      void cancelTask(taskId)
    },
    [cancelTask],
  )

  const estimateSize = useCallback(
    (index: number) => {
      const row = rows[index]
      const isExpanded = row?.kind === 'task' && expandedIds.has(row.task.id)
      return queueRowHeight(row, isExpanded)
    },
    [rows, expandedIds],
  )

  const renderRow = useCallback(
    (row: QueueRow, _index: number, style: React.CSSProperties) => {
      if (row.kind === 'group') {
        return (
          <div
            key={row.sessionId}
            style={style}
            className="flex items-center gap-2 px-3 h-7 bg-hover/60 text-xs text-text-muted"
          >
            <span className="truncate font-medium text-text-secondary">{row.name}</span>
            <span className="tabular-nums shrink-0">
              {row.running}/{row.total}
            </span>
            {row.failed > 0 && (
              <span className="tabular-nums shrink-0 text-danger">{row.failed}</span>
            )}
          </div>
        )
      }

      return (
        <TransferTaskItem
          key={row.task.id}
          task={row.task}
          isExpanded={expandedIds.has(row.task.id)}
          onToggleExpand={toggleExpand}
          onRetry={handleRetry}
          onCancel={handleCancel}
          onRemove={handleCancel}
          style={style}
        />
      )
    },
    [expandedIds, handleCancel, handleRetry, toggleExpand],
  )

  return (
    <div className="flex-1 min-h-0">
      <VirtualRows
        items={rows}
        estimateSize={estimateSize}
        revision={measureRevision}
        renderRow={renderRow}
      />
    </div>
  )
}
