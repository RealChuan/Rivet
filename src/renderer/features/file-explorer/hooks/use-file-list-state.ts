import { useCallback, useState } from 'react'
import { type FileInfo } from '@shared/types/index.js'

export interface ContextMenuState {
  x: number
  y: number
  files: FileInfo[]
  isEmptyArea: boolean
}

export const useFileListState = () => {
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([])
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState<FileInfo[] | null>(null)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)

  const handleSelectFile = (file: FileInfo) => {
    setSelectedFile(file)
    setSelectedFiles([file])
  }

  const handleMultiSelect = (
    file: FileInfo,
    isCtrl: boolean,
    isShift: boolean,
    sortedFiles: FileInfo[]
  ) => {
    setSelectedFiles(prev => {
      if (isCtrl) {
        const exists = prev.find(f => f.name === file.name)
        if (exists) {
          return prev.filter(f => f.name !== file.name)
        }
        return [...prev, file]
      } else if (isShift && prev.length > 0) {
        const currentIndex = sortedFiles.findIndex(f => f.name === file.name)
        const lastSelectedIndex = sortedFiles.findIndex(f => f.name === prev[prev.length - 1]?.name)
        const start = Math.min(currentIndex, lastSelectedIndex)
        const end = Math.max(currentIndex, lastSelectedIndex)
        return sortedFiles.slice(start, end + 1)
      }
      return [file]
    })
    setSelectedFile(file)
  }

  const handleSelectAll = (sortedFiles: FileInfo[]) => {
    setSelectedFiles(sortedFiles)
    if (sortedFiles.length > 0) {
      setSelectedFile(sortedFiles[sortedFiles.length - 1] ?? null)
    }
  }

  const clearSelection = () => {
    setSelectedFiles([])
    setSelectedFile(null)
  }

  const openDeleteDialog = (files: FileInfo[]) => {
    setFileToDelete(files)
    setDeleteDialogOpen(true)
  }

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setFileToDelete(null)
  }

  const openRenameDialog = (file: FileInfo) => {
    setSelectedFile(file)
    setRenameDialogOpen(true)
  }

  const closeRenameDialog = () => {
    setRenameDialogOpen(false)
  }

  const openContextMenu = (x: number, y: number, files: FileInfo[], isEmptyArea: boolean) => {
    setContextMenu({ x, y, files, isEmptyArea })
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  return {
    selectedFile,
    setSelectedFile,
    selectedFiles,
    setSelectedFiles,
    deleteDialogOpen,
    renameDialogOpen,
    fileToDelete,
    newFolderDialogOpen,
    setNewFolderDialogOpen,
    hoveredFile,
    setHoveredFile,
    contextMenu,
    handleSelectFile,
    handleMultiSelect,
    handleSelectAll,
    clearSelection,
    openDeleteDialog,
    closeDeleteDialog,
    openRenameDialog,
    closeRenameDialog,
    openContextMenu,
    closeContextMenu,
  }
}

export type UseFileListStateReturn = ReturnType<typeof useFileListState>

export default useFileListState
