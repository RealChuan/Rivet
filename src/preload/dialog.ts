import { ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import type { Result, ErrorInfo } from '@shared/types/result.js'

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
