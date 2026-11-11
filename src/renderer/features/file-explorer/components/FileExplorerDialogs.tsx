import { useTranslation } from 'react-i18next'

import { TOAST_TYPE } from '@shared/constants/index.js'
import { isOk } from '@shared/types/index.js'
import ConfirmationDialog from '../../../components/common/ConfirmationDialog.js'
import TextInputDialog from '../../../components/common/TextInputDialog.js'
import { useUiStore } from '../../../stores/index.js'
import { useConnectionFavorites } from '../hooks/use-connection-favorites.js'
import { useCopyPath } from '../hooks/use-copy-path.js'
import { type UseFileCopyMoveReturn } from '../hooks/use-file-copy-move.js'
import { useFileDeletion } from '../hooks/use-file-deletion.js'
import { type UseFileListStateReturn } from '../hooks/use-file-list-state.js'
import { useFilePermissions } from '../hooks/use-file-permissions.js'
import { useFileRenaming } from '../hooks/use-file-renaming.js'
import { useFolderCreation } from '../hooks/use-folder-creation.js'
import { useTransferDialog } from '../hooks/use-transfer-dialog.js'
import ConflictDialog from './ConflictDialog.js'
import FileExplorerContextMenu from './FileExplorerContextMenu.js'
import FilePropertiesDialog from './FilePropertiesDialog.js'
import PermissionsDialog from './PermissionsDialog.js'
import TargetFolderDialog from './TargetFolderDialog.js'

interface FileExplorerDialogsProps {
  sessionId: string
  currentPath: string
  listState: UseFileListStateReturn
  copyMove: UseFileCopyMoveReturn
  isSftp?: boolean | undefined
  onClearSelection: () => void
}

export const FileExplorerDialogs = ({
  sessionId,
  currentPath,
  listState,
  copyMove,
  isSftp,
  onClearSelection,
}: FileExplorerDialogsProps) => {
  const { t } = useTranslation()
  const addToast = useUiStore((state) => state.addToast)

  const { copyPaths } = useCopyPath()
  const { favoritePaths, toggleFavorite } = useConnectionFavorites(sessionId)
  const { handleDelete } = useFileDeletion(sessionId)
  const { handleRename } = useFileRenaming(sessionId)
  const { handleChangePermissions } = useFilePermissions(sessionId)
  const { handleCreateFolder } = useFolderCreation(sessionId)
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
    permissionsDialogOpen,
    permissionsDialogFile,
    openPermissionsDialog,
    closePermissionsDialog,
  } = listState

  const {
    handleCopy,
    handleCut,
    handlePaste,
    canPaste,
    handleCopyTo,
    handleMoveTo,
    handleSelectTargetFolder,
    handleConflictResolution,
    targetFolderDialogOpen,
    conflictDialogOpen,
    conflicts,
    pendingFiles,
    pendingTargetDir,
    setTargetFolderDialogOpen,
    setConflictDialogOpen,
  } = copyMove

  const handlePasteHere = () => {
    void handlePaste(currentPath)
  }

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

      <FilePropertiesDialog
        open={propertiesDialogOpen}
        onClose={closePropertiesDialog}
        file={propertiesDialogFile}
        isSftp={isSftp}
        onEditPermissions={(file) => {
          closePropertiesDialog()
          openPermissionsDialog(file)
        }}
      />

      <PermissionsDialog
        open={permissionsDialogOpen}
        onClose={closePermissionsDialog}
        file={permissionsDialogFile}
        onApply={(mode) => {
          if (!permissionsDialogFile) return
          void handleChangePermissions(permissionsDialogFile, mode)
          closePermissionsDialog()
        }}
      />

      <FileExplorerContextMenu
        files={contextMenu?.files ?? []}
        isEmptyArea={contextMenu?.isEmptyArea ?? false}
        canPaste={canPaste}
        onCopy={handleCopy}
        onCut={handleCut}
        onPaste={handlePasteHere}
        onCopyTo={handleCopyTo}
        onMoveTo={handleMoveTo}
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
        onPermissions={openPermissionsDialog}
        isSftp={isSftp}
        onCopyPath={(files) => {
          const paths = files.length > 0 ? files.map((file) => file.absolutePath) : [currentPath]
          void copyPaths(paths)
        }}
        isFavorite={(file) => favoritePaths.has(file.absolutePath)}
        onToggleFavorite={(file) => toggleFavorite(file.absolutePath)}
      />
    </>
  )
}

export default FileExplorerDialogs
