import { useState } from 'react'
import { toggleSortOrder } from '@renderer/utils/sort-utils.js'
import {
  FILE_TYPE,
  type FileExplorerSortField,
  SORT_FIELD,
  SORT_ORDER,
  type SortOrderWithDirection,
} from '@shared/constants/index.js'
import { type FileInfo } from '@shared/types/index.js'

export const useFileSort = (files: FileInfo[]) => {
  const [sortBy, setSortBy] = useState<FileExplorerSortField>(SORT_FIELD.NAME)
  const [sortOrder, setSortOrder] = useState<SortOrderWithDirection>(SORT_ORDER.ASC)

  const sortedFiles = (() => {
    const result = [...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === FILE_TYPE.DIRECTORY ? -1 : 1
      }
      let result = 0
      switch (sortBy) {
        case SORT_FIELD.NAME:
          result = a.name.localeCompare(b.name)
          break
        case SORT_FIELD.PERMISSIONS:
          result = (a.permissions ?? '').localeCompare(b.permissions ?? '')
          break
        case SORT_FIELD.OWNER:
          result = (a.owner ?? '').localeCompare(b.owner ?? '')
          break
        case SORT_FIELD.SIZE:
          result = (a.size ?? 0) - (b.size ?? 0)
          break
        case SORT_FIELD.MODIFY_TIME:
          result = (a.modifyTime ?? 0) - (b.modifyTime ?? 0)
          break
      }
      return sortOrder === SORT_ORDER.ASC ? result : -result
    })
    return result
  })()

  const handleSort = (column: FileExplorerSortField) => {
    const { sortField, sortOrder: newOrder } = toggleSortOrder(sortBy, sortOrder, column)
    setSortBy(sortField)
    setSortOrder(newOrder)
  }

  return {
    sortBy,
    sortOrder,
    sortedFiles,
    handleSort,
  }
}

export default useFileSort
