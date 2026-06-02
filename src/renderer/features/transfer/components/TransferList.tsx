import type React from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferTask } from '@shared/types/transfer.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import { useTransferStore } from '@renderer/features/transfer/stores/transfer.js'
import { TRANSFER_CONFIG, TRANSFER_ITEM_TYPE } from '@shared/constants/transfer.js'
import { useTransferSort } from '../hooks/useTransferSort.js'
import { TransferActionBar } from './TransferActionBar.js'
import { TransferTabBar } from './TransferTabBar.js'
import { TransferTaskItem } from './TransferTaskItem.js'

const FILE_ROW_HEIGHT = 40
const FOLDER_HEADER_HEIGHT = 40
const FOLDER_OP_ROW_HEIGHT = 32

export const TransferList: React.FC = () => {
  const { t } = useTranslation()
  const { sortBy, sortOrder, setSort, sortedTasks } = useTransferSort()
  const selectedSessionId = useTransferStore(state => state.selectedSessionId)

  const handleRetry = useCallback((taskId: string) => {
    void window.electronAPI.transfer.retry(taskId)
  }, [])

  const handleCancel = useCallback((taskId: string) => {
    void window.electronAPI.transfer.cancel(taskId)
  }, [])

  const handleRemove = useCallback((taskId: string) => {
    useTransferStore.getState().handleTaskRemoved({ taskId })
  }, [])

  const handleCancelAll = useCallback(() => {
    if (selectedSessionId) {
      void window.electronAPI.transfer.cancelAll(selectedSessionId)
    } else {
      void window.electronAPI.transfer.cancelAll()
    }
  }, [selectedSessionId])

  const renderItem = useCallback(
    (task: TransferTask, _index: number, style: React.CSSProperties) => (
      <TransferTaskItem
        key={task.id}
        task={task}
        onRetry={handleRetry}
        onCancel={handleCancel}
        onRemove={handleRemove}
        style={style}
      />
    ),
    [handleRetry, handleCancel, handleRemove]
  )

  const getItemHeightForIndex = useCallback(
    (index: number) => {
      const task = sortedTasks[index]
      if (!task) return FILE_ROW_HEIGHT
      if (task.itemType !== TRANSFER_ITEM_TYPE.FOLDER) return FILE_ROW_HEIGHT
      return FOLDER_HEADER_HEIGHT + TRANSFER_CONFIG.MAX_INLINE_OPERATIONS * FOLDER_OP_ROW_HEIGHT
    },
    [sortedTasks]
  )

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TransferTabBar />

      <TransferActionBar
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={setSort}
        onCancelAll={handleCancelAll}
      />

      <div className="flex-1 min-h-0">
        {sortedTasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-2">
            <div className="w-16 h-16 rounded-lg bg-hover flex items-center justify-center">
              <svg
                className="w-6 h-6 stroke-text-muted/60"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.5"
              >
                <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-xs text-text-muted">{t('transfer.noActiveTasks')}</p>
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
