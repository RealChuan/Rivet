import { useMemo, useState } from 'react'
import type { TransferTask } from '@shared/types/transfer.js'
import { toggleSortOrder } from '@renderer/utils/sort-utils.js'
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

/**
 * Per-session transfer sort hook.
 *
 * Sort state is local to each TransferSessionArea instance,
 * so sorting one server's tasks does not affect others.
 */
export function useTransferSort(tasks: TransferTask[]): UseTransferSortReturn {
  const [sortBy, setSortByState] = useState<TransferSortField>(TRANSFER_SORT_FIELD.CREATED_AT)
  const [sortOrder, setSortOrderState] = useState<SortOrderWithDirection>(SORT_ORDER.DESC)

  const sortedTasks = useMemo(() => sortTasks(tasks, sortBy, sortOrder), [tasks, sortBy, sortOrder])

  const setSort = (field: TransferSortField) => {
    const { sortField, sortOrder: newOrder } = toggleSortOrder(sortBy, sortOrder, field)
    setSortByState(sortField)
    setSortOrderState(newOrder)
  }

  return { sortBy, sortOrder, setSort, sortedTasks }
}
