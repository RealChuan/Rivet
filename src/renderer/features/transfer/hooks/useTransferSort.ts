import { useMemo } from 'react'
import type { TransferTask } from '@shared/types/transfer.js'
import { useTransferStore } from '@renderer/features/transfer/stores/transfer.js'
import { SORT_ORDER, type SortOrderWithDirection } from '@shared/constants/sort.js'
import { TRANSFER_SORT_FIELD, type TransferSortField } from '@shared/constants/transfer.js'

interface UseTransferSortReturn {
  sortBy: TransferSortField
  sortOrder: SortOrderWithDirection
  setSort: (field: TransferSortField) => void
  sortedTasks: TransferTask[]
}

function computeRemainingTime(task: TransferTask): number {
  if (!task.startedAt || task.transferredSize === 0) return Infinity
  const elapsed = (Date.now() - task.startedAt) / 1000
  if (elapsed <= 0) return Infinity
  const speed = task.transferredSize / elapsed
  if (speed <= 0) return Infinity
  return (task.fileSize - task.transferredSize) / speed
}

function sortTasks(
  tasks: TransferTask[],
  sortBy: TransferSortField,
  sortOrder: SortOrderWithDirection
): TransferTask[] {
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0
    switch (sortBy) {
      case TRANSFER_SORT_FIELD.NAME:
        cmp = a.itemName.localeCompare(b.itemName)
        break
      case TRANSFER_SORT_FIELD.CREATED_AT:
        cmp = a.createdAt - b.createdAt
        break
      case TRANSFER_SORT_FIELD.STATUS:
        cmp = a.status.localeCompare(b.status)
        break
      case TRANSFER_SORT_FIELD.REMAINING_TIME:
        cmp = computeRemainingTime(a) - computeRemainingTime(b)
        break
    }
    return sortOrder === SORT_ORDER.ASC ? cmp : -cmp
  })
  return sorted
}

export function useTransferSort(): UseTransferSortReturn {
  const sortBy = useTransferStore(state => state.sortBy)
  const sortOrder = useTransferStore(state => state.sortOrder)
  const storeSetSort = useTransferStore(state => state.setSort)
  const tasks = useTransferStore(state => state.tasks)
  const selectedSessionId = useTransferStore(state => state.selectedSessionId)

  const filteredTasks = useMemo(
    () => (selectedSessionId ? tasks.filter(t => t.sessionId === selectedSessionId) : tasks),
    [tasks, selectedSessionId]
  )

  const sortedTasks = useMemo(
    () => sortTasks(filteredTasks, sortBy, sortOrder),
    [filteredTasks, sortBy, sortOrder]
  )

  const setSort = (field: TransferSortField) => {
    if (field === sortBy) {
      storeSetSort(field, sortOrder === SORT_ORDER.ASC ? SORT_ORDER.DESC : SORT_ORDER.ASC)
    } else {
      storeSetSort(field, SORT_ORDER.ASC)
    }
  }

  return { sortBy, sortOrder, setSort, sortedTasks }
}

export { computeRemainingTime }
