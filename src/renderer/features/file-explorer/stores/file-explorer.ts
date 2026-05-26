import { create } from 'zustand'
import {
  type FileExplorerSortFieldBasic,
  type SortOrderWithDirection,
} from '@shared/constants/index.js'

export interface FileExplorerState {
  sortField: FileExplorerSortFieldBasic
  sortOrder: SortOrderWithDirection
  viewMode: 'list' | 'grid'
  showHiddenFiles: boolean
  selectedFiles: Set<string>

  setSortField: (field: FileExplorerSortFieldBasic) => void
  setSortOrder: (order: SortOrderWithDirection) => void
  toggleSortOrder: () => void
  setViewMode: (mode: 'list' | 'grid') => void
  setShowHiddenFiles: (show: boolean) => void
  toggleShowHiddenFiles: () => void
  setSelectedFiles: (files: Set<string>) => void
  addSelectedFile: (filename: string) => void
  removeSelectedFile: (filename: string) => void
  clearSelectedFiles: () => void
  toggleSelectedFile: (filename: string) => void
}

export const useFileExplorerStore = create<FileExplorerState>(set => ({
  sortField: 'name',
  sortOrder: 'asc',
  viewMode: 'list',
  showHiddenFiles: false,
  selectedFiles: new Set(),

  setSortField: field =>
    set(state => ({
      sortField: field,
      sortOrder: field === state.sortField ? state.sortOrder : 'asc',
    })),

  setSortOrder: order => set({ sortOrder: order }),

  toggleSortOrder: () =>
    set(state => ({
      sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc',
    })),

  setViewMode: mode => set({ viewMode: mode }),

  setShowHiddenFiles: show => set({ showHiddenFiles: show }),

  toggleShowHiddenFiles: () => set(state => ({ showHiddenFiles: !state.showHiddenFiles })),

  setSelectedFiles: files => set({ selectedFiles: files }),

  addSelectedFile: filename =>
    set(state => {
      const newSet = new Set(state.selectedFiles)
      newSet.add(filename)
      return { selectedFiles: newSet }
    }),

  removeSelectedFile: filename =>
    set(state => {
      const newSet = new Set(state.selectedFiles)
      newSet.delete(filename)
      return { selectedFiles: newSet }
    }),

  clearSelectedFiles: () => set({ selectedFiles: new Set() }),

  toggleSelectedFile: filename =>
    set(state => {
      const newSet = new Set(state.selectedFiles)
      if (newSet.has(filename)) {
        newSet.delete(filename)
      } else {
        newSet.add(filename)
      }
      return { selectedFiles: newSet }
    }),
}))

export default useFileExplorerStore
