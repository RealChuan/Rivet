import { ipcRenderer } from 'electron'
import type { ErrorInfo, Result } from '@shared/types/index.js'
import { IPC_CHANNELS } from '@shared/constants/index.js'

export const dialogAPI = {
  showOpenDialog: (options: { properties: string[] }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG.SHOW_OPEN_DIALOG, options) as Promise<
      Result<{ canceled: boolean; filePaths: string[] } | undefined, ErrorInfo>
    >,
  showSaveDialog: (options: unknown) =>
    ipcRenderer.invoke(IPC_CHANNELS.DIALOG.SHOW_SAVE_DIALOG, options) as Promise<
      Result<{ canceled: boolean; filePath?: string } | undefined, ErrorInfo>
    >,
}

export type DialogAPI = typeof dialogAPI
