import type React from 'react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferTask } from '@shared/types/transfer.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import { useTransferStore } from '@renderer/features/transfer/stores/transfer.js'
import { TRANSFER_CONFIG, TRANSFER_ITEM_TYPE } from '@shared/constants/transfer.js'
import { useTransferSort } from '../hooks/use-transfer-sort.js'
import { TransferActionBar } from './TransferActionBar.js'
import { TransferTabBar } from './TransferTabBar.js'
import { TransferTaskItem } from './TransferTaskItem.js'

const FILE_ROW_HEIGHT = 44
const FOLDER_HEADER_HEIGHT = 44
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
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div
              className={`
                w-16 h-16 rounded-xl
                bg-hover flex items-center justify-center
              `}
            >
              <svg
                className="w-7 h-7 stroke-text-muted stroke-[1.5]"
                viewBox="0 0 24 24"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-text mb-1">{t('transfer.noActiveTasks')}</p>
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
