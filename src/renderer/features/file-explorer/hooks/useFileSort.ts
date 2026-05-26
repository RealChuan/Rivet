import { useState } from 'react'
import { type FileInfo } from '@shared/types/index.js'
import { type FileExplorerSortField, type SortOrderWithDirection } from '@shared/constants/index.js'

export const useFileSort = (files: FileInfo[]) => {
  const [sortBy, setSortBy] = useState<FileExplorerSortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrderWithDirection>('asc')

  const sortedFiles = (() => {
    const result = [...files].sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1
      }
      let result = 0
      switch (sortBy) {
        case 'name':
          result = a.name.localeCompare(b.name)
          break
        case 'permissions':
          result = (a.permissions ?? '').localeCompare(b.permissions ?? '')
          break
        case 'owner':
          result = (a.owner ?? '').localeCompare(b.owner ?? '')
          break
        case 'size':
          result = (a.size ?? 0) - (b.size ?? 0)
          break
        case 'modifyTime':
          result = (a.modifyTime ?? 0) - (b.modifyTime ?? 0)
          break
      }
      return sortOrder === 'asc' ? result : -result
    })
    return result
  })()

  const handleSort = (column: FileExplorerSortField) => {
    if (sortBy === column) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortOrder('asc')
    }
  }

  return {
    sortBy,
    sortOrder,
    sortedFiles,
    handleSort,
  }
}

export default useFileSort
