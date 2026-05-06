import { LAST_DIR_KEY } from '@shared/constants/transfer.js'
import { FILE_TYPE, type FileType } from '@shared/constants/ui.js'
import { dialogApi } from '../../../api/dialog.js'
import { systemApi } from '../../../api/system.js'
import { transferApi } from '../../../api/transfer.js'
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
  try {
    const lastDir = await transferApi.getLastDir(LAST_DIR_KEY[lastDirKey])
    if (lastDir) return lastDir
    return await systemApi.getDownloadDir()
  } catch {
    return undefined
  }
}

export function useTransferDialog({ sessionId, currentPath }: UseTransferDialogOptions) {
  const { startUpload, startDownload } = useFileExplorerTransferActions()

  const openFilePicker = async () => {
    const defaultPath = await getDefaultPath('UPLOAD')
    const result = await dialogApi.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      defaultPath,
    })
    if (!result || result.canceled || result.filePaths.length === 0) return

    if (result.filePaths[0]) {
      const parts = result.filePaths[0].replace(/\\/g, '/').split('/')
      parts.pop()
      const parentDir = parts.join('/')
      if (parentDir) {
        await transferApi.setLastDir(LAST_DIR_KEY.UPLOAD, parentDir)
      }
    }

    await startUpload(result.filePaths, sessionId, currentPath, FILE_TYPE.FILE)
  }

  const openFolderPicker = async () => {
    const defaultPath = await getDefaultPath('UPLOAD')
    const result = await dialogApi.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
    if (!result || result.canceled || result.filePaths.length === 0) return

    if (result.filePaths[0]) {
      await transferApi.setLastDir(LAST_DIR_KEY.UPLOAD, result.filePaths[0])
    }

    await startUpload(result.filePaths, sessionId, currentPath, FILE_TYPE.DIRECTORY)
  }

  const openDownloadDialog = async (remoteItems: RemoteItem[]) => {
    if (remoteItems.length === 0) return

    const defaultPath = await getDefaultPath('DOWNLOAD')

    const result = await dialogApi.showOpenDialog({
      properties: ['openDirectory'],
      defaultPath,
    })
    if (!result || result.canceled || result.filePaths.length === 0) return

    const localDir = result.filePaths[0]
    if (!localDir) return

    await transferApi.setLastDir(LAST_DIR_KEY.DOWNLOAD, localDir)

    await startDownload(remoteItems, sessionId, localDir)
  }

  return { openFilePicker, openFolderPicker, openDownloadDialog }
}
