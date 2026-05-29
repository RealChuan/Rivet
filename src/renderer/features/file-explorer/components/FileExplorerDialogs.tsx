import type React from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmationDialog from '@renderer/components/common/ConfirmationDialog.js'
import TextInputDialog from '@renderer/components/common/TextInputDialog.js'
import { type UseFileCopyMoveReturn } from '@renderer/features/file-explorer/hooks/useFileCopyMove.js'
import { type ContextMenuState } from '@renderer/features/file-explorer/hooks/useFileListState.js'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { type FileInfo, isOk } from '@shared/types/index.js'
import ConflictDialog from './ConflictDialog.js'
import FileExplorerContextMenu from './FileExplorerContextMenu.js'
import TargetFolderDialog from './TargetFolderDialog.js'

interface FileExplorerDialogsProps {
  sessionId: string
  selectedFile: FileInfo | null
  deleteDialogOpen: boolean
  closeDeleteDialog: () => void
  fileToDelete: FileInfo[] | null
  handleDelete: (files: FileInfo[]) => Promise<void>
  renameDialogOpen: boolean
  closeRenameDialog: () => void
  handleRenameWrapper: (newName: string) => void
  newFolderDialogOpen: boolean
  setNewFolderDialogOpen: (open: boolean) => void
  handleCreateFolderWrapper: (folderName: string) => void
  fileCopyMoveState: UseFileCopyMoveReturn
  contextMenu: ContextMenuState | null
  closeContextMenu: () => void
  openDeleteDialog: (files: FileInfo[]) => void
  openRenameDialog: (file: FileInfo) => void
}

export const FileExplorerDialogs: React.FC<FileExplorerDialogsProps> = ({
  sessionId,
  selectedFile,
  deleteDialogOpen,
  closeDeleteDialog,
  fileToDelete,
  handleDelete,
  renameDialogOpen,
  closeRenameDialog,
  handleRenameWrapper,
  newFolderDialogOpen,
  setNewFolderDialogOpen,
  handleCreateFolderWrapper,
  fileCopyMoveState,
  contextMenu,
  closeContextMenu,
  openDeleteDialog,
  openRenameDialog,
}) => {
  const { t } = useTranslation()
  const addToast = useUiStore(state => state.addToast)

  const {
    handleCopy,
    handleMove,
    handleSelectTargetFolder,
    handleConflictResolution,
    targetFolderDialogOpen,
    conflictDialogOpen,
    conflicts,
    pendingFiles,
    pendingTargetDir,
    setTargetFolderDialogOpen,
    setConflictDialogOpen,
  } = fileCopyMoveState

  return (
    <>
      <ConfirmationDialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        title={
          fileToDelete?.length === 1
            ? t('confirmationDialog.confirmDeleteTitle')
            : t('confirmationDialog.confirmDeleteMultipleTitle')
        }
        message={
          fileToDelete?.length === 1
            ? t('confirmationDialog.confirmDeleteMessage', { name: fileToDelete[0]?.name })
            : t('confirmationDialog.confirmDeleteMultipleMessage', { count: fileToDelete?.length })
        }
        confirmText={t('action.delete')}
        type="danger"
        onConfirm={() => {
          if (fileToDelete) {
            void handleDelete(fileToDelete)
          }
          closeDeleteDialog()
        }}
      />

      <TextInputDialog
        open={renameDialogOpen}
        onClose={closeRenameDialog}
        title={t('file.action.rename')}
        placeholder={t('textInputDialog.newNamePlaceholder')}
        defaultValue={selectedFile?.name ?? ''}
        submitText={t('file.action.rename')}
        onSubmit={handleRenameWrapper}
      />

      <TextInputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        title={t('file.action.newFolder')}
        placeholder={t('textInputDialog.folderNamePlaceholder')}
        submitText={t('action.create')}
        onSubmit={handleCreateFolderWrapper}
      />

      <TargetFolderDialog
        open={targetFolderDialogOpen}
        onClose={() => setTargetFolderDialogOpen(false)}
        onConfirm={targetDir => {
          void handleSelectTargetFolder(targetDir).then(result => {
            if (isOk(result)) {
              setTargetFolderDialogOpen(false)
            } else {
              addToast({ type: TOAST_TYPE.ERROR, message: result.error.message })
            }
          })
        }}
        sessionId={sessionId}
      />

      <ConflictDialog
        open={conflictDialogOpen}
        onClose={() => setConflictDialogOpen(false)}
        conflicts={conflicts}
        onConfirm={handleConflictResolution}
        targetDir={pendingTargetDir ?? null}
        files={pendingFiles}
      />

      {contextMenu && (
        <FileExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          files={contextMenu.files}
          isEmptyArea={contextMenu.isEmptyArea}
          onClose={closeContextMenu}
          onCopy={handleCopy}
          onMove={handleMove}
          onDelete={openDeleteDialog}
          onRename={openRenameDialog}
          onCreateFolder={() => {
            setNewFolderDialogOpen(true)
            closeContextMenu()
          }}
        />
      )}
    </>
  )
}

export default FileExplorerDialogs
