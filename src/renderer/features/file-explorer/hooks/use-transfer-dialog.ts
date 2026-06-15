import { LAST_DIR_KEY } from '@shared/constants/transfer.js'
import { FILE_TYPE, type FileType } from '@shared/constants/ui.js'
import { isOk } from '@shared/types/index.js'
import { useFileExplorerTransferActions } from '../contexts/transfer-actions.js'

interface RemoteItem {
  path: string
  name: string
  type: FileType
  size: number
}

interface UseTransferDialogOptions {
  sessionId: string
  currentPath: string
}

async function getDefaultPath(lastDirKey: 'UPLOAD' | 'DOWNLOAD'): Promise<string | undefined> {
  const lastDir = await window.electronAPI.transfer.getLastDir(LAST_DIR_KEY[lastDirKey])
  if (lastDir) return lastDir
  const downloadDirResult = await window.electronAPI.system.getDownloadDir()
  return downloadDirResult.success ? downloadDirResult.value : undefined
}

export function useTransferDialog({ sessionId, currentPath }: UseTransferDialogOptions) {
  const { startUpload, startDownload } = useFileExplorerTransferActions()

  const openFilePicker = async () => {
    const defaultPath = await getDefaultPath('UPLOAD')
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      defaultPath,
    })
    if (!isOk(result) || !result.value) return
    if (result.value.canceled || result.value.filePaths.length === 0) return

    if (result.value.filePaths[0]) {
      const parts = result.value.filePaths[0].replace(/\\/g, '/').split('/')
      parts.pop()
      const parentDir = parts.join('/')
      if (parentDir) {
        await window.electronAPI.transfer.setLastDir(LAST_DIR_KEY.UPLOAD, parentDir)
      }
    }

    await startUpload(result.value.filePaths, sessionId, currentPath, FILE_TYPE.FILE)
  }

  const openFolderPicker = async () => {
    const defaultPath = await getDefaultPath('UPLOAD')
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
    if (!isOk(result) || !result.value) return
    if (result.value.canceled || result.value.filePaths.length === 0) return

    if (result.value.filePaths[0]) {
      await window.electronAPI.transfer.setLastDir(LAST_DIR_KEY.UPLOAD, result.value.filePaths[0])
    }

    await startUpload(result.value.filePaths, sessionId, currentPath, FILE_TYPE.DIRECTORY)
  }

  const openDownloadDialog = async (remoteItems: RemoteItem[]) => {
    if (remoteItems.length === 0) return

    const defaultPath = await getDefaultPath('DOWNLOAD')

    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
    if (!isOk(result) || !result.value) return
    if (result.value.canceled || result.value.filePaths.length === 0) return

    const localDir = result.value.filePaths[0]
    if (!localDir) return

    await window.electronAPI.transfer.setLastDir(LAST_DIR_KEY.DOWNLOAD, localDir)

    const itemType = remoteItems.some(i => i.type === FILE_TYPE.DIRECTORY)
      ? FILE_TYPE.DIRECTORY
      : FILE_TYPE.FILE

    await startDownload(remoteItems, sessionId, localDir, itemType)
  }

  return { openFilePicker, openFolderPicker, openDownloadDialog }
}
