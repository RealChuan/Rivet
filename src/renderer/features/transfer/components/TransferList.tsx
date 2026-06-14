import type React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferTask } from '@shared/types/transfer.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import { useTransferActions } from '../hooks/use-transfer-actions.js'
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
  const { retryTask, cancelTask } = useTransferActions()

  const handleRetry = useCallback(
    (taskId: string) => {
      void retryTask(taskId)
    },
    [retryTask]
  )

  const handleCancel = useCallback(
    (taskId: string) => {
      void cancelTask(taskId)
    },
    [cancelTask]
  )

  const renderItem = useCallback(
    (task: TransferTask, _index: number, style: React.CSSProperties) => (
      <TransferTaskItem
        key={task.id}
        task={task}
        onRetry={handleRetry}
        onCancel={handleCancel}
        onRemove={handleCancel}
        style={style}
      />
    ),
    [handleCancel, handleRetry]
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
