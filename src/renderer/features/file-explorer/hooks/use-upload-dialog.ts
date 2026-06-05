import { useTransferActions } from '@renderer/features/transfer/hooks/use-transfer-actions.js'
import { TRANSFER_ITEM_TYPE } from '@shared/constants/transfer.js'
import { isOk } from '@shared/types/index.js'

interface UseUploadDialogOptions {
  sessionId: string
  currentPath: string
}

export function useUploadDialog({ sessionId, currentPath }: UseUploadDialogOptions) {
  const { startUpload } = useTransferActions()

  const openFilePicker = async () => {
    const downloadDirResult = await window.electronAPI.system.getDownloadDir()
    const defaultPath = downloadDirResult.success ? downloadDirResult.value : undefined
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      defaultPath,
    })
    if (!isOk(result) || !result.value) return
    if (result.value.canceled || result.value.filePaths.length === 0) return
    await startUpload(result.value.filePaths, sessionId, currentPath, TRANSFER_ITEM_TYPE.FILE)
  }

  const openFolderPicker = async () => {
    const downloadDirResult = await window.electronAPI.system.getDownloadDir()
    const defaultPath = downloadDirResult.success ? downloadDirResult.value : undefined
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
    if (!isOk(result) || !result.value) return
    if (result.value.canceled || result.value.filePaths.length === 0) return
    await startUpload(result.value.filePaths, sessionId, currentPath, TRANSFER_ITEM_TYPE.FOLDER)
  }

  return { openFilePicker, openFolderPicker }
}
