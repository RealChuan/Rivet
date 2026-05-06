import { useTranslation } from 'react-i18next'

import { TOAST_TYPE } from '@shared/constants/index.js'
import { isOk } from '@shared/types/index.js'
import ConfirmationDialog from '../../../components/common/ConfirmationDialog.js'
import TextInputDialog from '../../../components/common/TextInputDialog.js'
import { useUiStore } from '../../../stores/index.js'
import { useFileCopyMove } from '../hooks/use-file-copy-move.js'
import { useFileDeletion } from '../hooks/use-file-deletion.js'
import { type UseFileListStateReturn } from '../hooks/use-file-list-state.js'
import { useFileRenaming } from '../hooks/use-file-renaming.js'
import { useFolderCreation } from '../hooks/use-folder-creation.js'
import { useTransferDialog } from '../hooks/use-transfer-dialog.js'
import ConflictDialog from './ConflictDialog.js'
import FileExplorerContextMenu from './FileExplorerContextMenu.js'
import FolderPropertiesDialog from './FolderPropertiesDialog.js'
import TargetFolderDialog from './TargetFolderDialog.js'

interface FileExplorerDialogsProps {
  sessionId: string
  currentPath: string
  listState: UseFileListStateReturn
  isSftp?: boolean | undefined
  onClearSelection: () => void
}

export const FileExplorerDialogs = ({
  sessionId,
  currentPath,
  listState,
  isSftp,
  onClearSelection,
}: FileExplorerDialogsProps) => {
  const { t } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)

  const { handleDelete } = useFileDeletion(sessionId)
  const { handleRename } = useFileRenaming(sessionId)
  const { handleCreateFolder } = useFolderCreation(sessionId)
  const fileCopyMoveState = useFileCopyMove(sessionId)
  const { openFilePicker, openFolderPicker, openDownloadDialog } = useTransferDialog({
    sessionId,
    currentPath,
  })

  const {
    deleteDialogOpen,
    closeDeleteDialog,
    fileToDelete,
    renameDialogOpen,
    renameTarget,
    closeRenameDialog,
    newFolderDialogOpen,
    setNewFolderDialogOpen,
    contextMenu,
    openDeleteDialog,
    openRenameDialog,
    propertiesDialogOpen,
    propertiesDialogFile,
    openPropertiesDialog,
    closePropertiesDialog,
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
    if (renameTarget) {
      void handleRename(renameTarget, newName)
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
            ? t(($) => $.confirmationDialog.confirmDeleteTitle)
            : t(($) => $.confirmationDialog.confirmDeleteMultipleTitle)
        }
        message={
          fileToDelete?.length === 1
            ? t(($) => $.confirmationDialog.confirmDeleteMessage, { name: fileToDelete[0]?.name })
            : t(($) => $.confirmationDialog.confirmDeleteMultipleMessage, {
                count: fileToDelete?.length ?? 0,
              })
        }
        confirmText={t(($) => $.common.action.delete)}
        type="danger"
        onConfirm={() => {
          if (fileToDelete) {
            void handleDelete(fileToDelete).then(() => {
              onClearSelection()
            })
          }
          closeDeleteDialog()
        }}
      />

      <TextInputDialog
        open={renameDialogOpen}
        onClose={closeRenameDialog}
        title={t(($) => $.file.action.rename)}
        placeholder={t(($) => $.textInputDialog.newNamePlaceholder)}
        defaultValue={renameTarget?.name ?? ''}
        submitText={t(($) => $.file.action.rename)}
        onSubmit={handleRenameWrapper}
      />

      <TextInputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        title={t(($) => $.file.action.newFolder)}
        placeholder={t(($) => $.textInputDialog.folderNamePlaceholder)}
        submitText={t(($) => $.common.action.create)}
        onSubmit={handleCreateFolderWrapper}
      />

      <TargetFolderDialog
        open={targetFolderDialogOpen}
        onClose={() => setTargetFolderDialogOpen(false)}
        onConfirm={(targetDir) => {
          void handleSelectTargetFolder(targetDir).then((result) => {
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

      <FolderPropertiesDialog
        open={propertiesDialogOpen}
        onClose={closePropertiesDialog}
        file={propertiesDialogFile}
        isSftp={isSftp}
      />

      <FileExplorerContextMenu
        files={contextMenu?.files ?? []}
        isEmptyArea={contextMenu?.isEmptyArea ?? false}
        onCopy={handleCopy}
        onMove={handleMove}
        onDelete={openDeleteDialog}
        onRename={openRenameDialog}
        onCreateFolder={() => setNewFolderDialogOpen(true)}
        onUploadFiles={() => void openFilePicker()}
        onUploadFolder={() => void openFolderPicker()}
        onDownload={(files) => {
          void openDownloadDialog(
            files.map((f) => ({
              path: f.absolutePath,
              name: f.name,
              type: f.type,
              size: f.size,
            })),
          )
        }}
        onProperties={openPropertiesDialog}
      />
    </>
  )
}

export default FileExplorerDialogs
