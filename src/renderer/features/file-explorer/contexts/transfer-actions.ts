import { createContext, useContext } from 'react'
import type { FileType } from '@shared/constants/ui.js'

interface TransferActions {
  startUpload: (
    localPaths: string[],
    sessionId: string,
    remoteDir: string,
    itemType?: FileType,
  ) => Promise<void>
  startMixedUpload: (
    filePaths: string[],
    folderPaths: string[],
    sessionId: string,
    remoteDir: string,
  ) => Promise<void>
  startDownload: (
    remoteItems: { path: string; name: string; type: FileType; size: number }[],
    sessionId: string,
    localDir: string,
  ) => Promise<void>
}

export const TransferActionsContext = createContext<TransferActions | null>(null)

export function useFileExplorerTransferActions(): TransferActions {
  const actions = useContext(TransferActionsContext)
  if (!actions) {
    throw new Error(
      'useFileExplorerTransferActions must be used within TransferActionsContext.Provider',
    )
  }
  return actions
}
