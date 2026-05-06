import { useCallback, useState } from 'react'

import { type FileInfo } from '@shared/types/index.js'

interface ContextMenuState {
  files: FileInfo[]
  isEmptyArea: boolean
}

export const useFileListState = () => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [renameDialogOpen, setRenameDialogOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileInfo | null>(null)
  const [fileToDelete, setFileToDelete] = useState<FileInfo[] | null>(null)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)
  const [hoveredFile, setHoveredFile] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [propertiesDialogOpen, setPropertiesDialogOpen] = useState(false)
  const [propertiesDialogFile, setPropertiesDialogFile] = useState<FileInfo | null>(null)

  const openDeleteDialog = (files: FileInfo[]) => {
    setFileToDelete(files)
    setDeleteDialogOpen(true)
  }

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false)
    setFileToDelete(null)
  }

  const openRenameDialog = (file: FileInfo) => {
    setRenameTarget(file)
    setRenameDialogOpen(true)
  }

  const closeRenameDialog = () => {
    setRenameDialogOpen(false)
    setRenameTarget(null)
  }

  const openContextMenu = (files: FileInfo[], isEmptyArea: boolean) => {
    setContextMenu({ files, isEmptyArea })
  }

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const openPropertiesDialog = (file: FileInfo) => {
    setPropertiesDialogFile(file)
    setPropertiesDialogOpen(true)
  }

  const closePropertiesDialog = () => {
    setPropertiesDialogOpen(false)
    setPropertiesDialogFile(null)
  }

  return {
    deleteDialogOpen,
    renameDialogOpen,
    renameTarget,
    fileToDelete,
    newFolderDialogOpen,
    setNewFolderDialogOpen,
    hoveredFile,
    setHoveredFile,
    contextMenu,
    openDeleteDialog,
    closeDeleteDialog,
    openRenameDialog,
    closeRenameDialog,
    openContextMenu,
    closeContextMenu,
    propertiesDialogOpen,
    propertiesDialogFile,
    openPropertiesDialog,
    closePropertiesDialog,
  }
}

export type UseFileListStateReturn = ReturnType<typeof useFileListState>
