import type React from 'react'
import { useTranslation } from 'react-i18next'
import ConfirmationDialog from '@renderer/components/common/ConfirmationDialog.js'
import TextInputDialog from '@renderer/components/common/TextInputDialog.js'
import { useFileCopyMove } from '@renderer/features/file-explorer/hooks/use-file-copy-move.js'
import { useFileDeletion } from '@renderer/features/file-explorer/hooks/use-file-deletion.js'
import { type UseFileListStateReturn } from '@renderer/features/file-explorer/hooks/use-file-list-state.js'
import { useFileRenaming } from '@renderer/features/file-explorer/hooks/use-file-renaming.js'
import { useFolderCreation } from '@renderer/features/file-explorer/hooks/use-folder-creation.js'
import { useTransferDialog } from '@renderer/features/file-explorer/hooks/use-transfer-dialog.js'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { isOk } from '@shared/types/index.js'
import ConflictDialog from './ConflictDialog.js'
import FileExplorerContextMenu from './FileExplorerContextMenu.js'
import TargetFolderDialog from './TargetFolderDialog.js'

interface FileExplorerDialogsProps {
  sessionId: string
  currentPath: string
  listState: UseFileListStateReturn
}

export const FileExplorerDialogs: React.FC<FileExplorerDialogsProps> = ({
  sessionId,
  currentPath,
  listState,
}) => {
  const { t } = useTranslation()
  const addToast = useUiStore(state => state.addToast)

  const { handleDelete } = useFileDeletion(sessionId)
  const { handleRename } = useFileRenaming(sessionId)
  const { handleCreateFolder } = useFolderCreation(sessionId)
  const fileCopyMoveState = useFileCopyMove(sessionId)
  const { openFilePicker, openFolderPicker, openDownloadDialog } = useTransferDialog({
    sessionId,
    currentPath,
  })

  const {
    selectedFile,
    deleteDialogOpen,
    closeDeleteDialog,
    fileToDelete,
    renameDialogOpen,
    closeRenameDialog,
    newFolderDialogOpen,
    setNewFolderDialogOpen,
    contextMenu,
    closeContextMenu,
    openDeleteDialog,
    openRenameDialog,
    clearSelection,
  } = listState

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

  const handleRenameWrapper = (newName: string) => {
    if (selectedFile) {
      void handleRename(selectedFile, newName)
      closeRenameDialog()
    }
  }

  const handleCreateFolderWrapper = (folderName: string) => {
    void handleCreateFolder(currentPath, folderName)
  }

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
        confirmText={t('common.action.delete')}
        type="danger"
        onConfirm={() => {
          if (fileToDelete) {
            void handleDelete(fileToDelete).then(() => {
              clearSelection()
            })
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
        submitText={t('common.action.create')}
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
          onUploadFiles={() => void openFilePicker()}
          onUploadFolder={() => void openFolderPicker()}
          onDownload={files => {
            void openDownloadDialog(
              files.map(f => ({
                path: f.absolutePath,
                name: f.name,
                type: f.type,
                size: f.size,
              }))
            )
          }}
        />
      )}
    </>
  )
}

export default FileExplorerDialogs
