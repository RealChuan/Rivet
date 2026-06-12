import type React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferTask } from '@shared/types/transfer.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import { useUiStore } from '@renderer/stores/index.js'
import { FILE_TYPE, TOAST_TYPE } from '@shared/constants/index.js'
import { TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import { useTransferSort } from '../hooks/use-transfer-sort.js'
import { TransferActionBar } from './TransferActionBar.js'
import { TransferTaskItem } from './TransferTaskItem.js'

const FILE_ROW_HEIGHT = 44
const FOLDER_HEADER_HEIGHT = 44
const FOLDER_OP_ROW_HEIGHT = 32

interface TransferListProps {
  tasks: TransferTask[]
  onCancelAll: () => void
}

export const TransferList: React.FC<TransferListProps> = ({ tasks, onCancelAll }) => {
  const { t } = useTranslation()
  const { sortBy, sortOrder, setSort, sortedTasks } = useTransferSort(tasks)
  const addToast = useUiStore(state => state.addToast)

  const handleRetry = useCallback(
    (taskId: string) => {
      void window.electronAPI.transfer.retry(taskId).catch(() => {
        addToast({ type: TOAST_TYPE.ERROR, message: t('transfer.retryFailed') })
      })
    },
    [addToast, t]
  )

  const handleCancel = useCallback(
    (taskId: string) => {
      void window.electronAPI.transfer.cancel(taskId).catch(() => {
        addToast({ type: TOAST_TYPE.ERROR, message: t('transfer.cancelFailed') })
      })
    },
    [addToast, t]
  )

  // remove 操作通过 cancel 实现
  const handleCancelRemove = useCallback(
    (taskId: string) => {
      void window.electronAPI.transfer.cancel(taskId).catch(() => {
        addToast({ type: TOAST_TYPE.ERROR, message: t('transfer.cancelFailed') })
      })
    },
    [addToast, t]
  )

  const renderItem = useCallback(
    (task: TransferTask, _index: number, style: React.CSSProperties) => (
      <TransferTaskItem
        key={task.id}
        task={task}
        onRetry={handleRetry}
        onCancel={handleCancel}
        onRemove={handleCancelRemove}
        style={style}
      />
    ),
    [handleCancel, handleCancelRemove, handleRetry]
  )

  const getItemHeightForIndex = useCallback(
    (index: number) => {
      const task = sortedTasks[index]
      if (!task) return FILE_ROW_HEIGHT
      if (task.itemType !== FILE_TYPE.DIRECTORY) return FILE_ROW_HEIGHT
      return FOLDER_HEADER_HEIGHT + TRANSFER_CONFIG.MAX_INLINE_OPERATIONS * FOLDER_OP_ROW_HEIGHT
    },
    [sortedTasks]
  )

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TransferActionBar
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={setSort}
        onCancelAll={onCancelAll}
      />

      <div className="flex-1 min-h-0">
        {sortedTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div
              className={`
                w-16 h-16 rounded-xl
                bg-hover border border-border flex items-center justify-center
              `}
            >
              <ArrowUpDown className="w-7 h-7 stroke-text-muted stroke-[1.5]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text mb-1">{t('transfer.empty')}</p>
            </div>
          </div>
        ) : (
          <VirtualList
            items={sortedTasks}
            itemHeight={getItemHeightForIndex}
            width="100%"
            renderItem={renderItem}
          />
        )}
      </div>
    </div>
  )
}
