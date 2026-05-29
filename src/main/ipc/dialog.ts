import { ipcMain, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { showOpenDialog, showSaveDialog } from '../utils/index.js'

export function setupDialogIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG.SHOW_SAVE_DIALOG, async (_, options: SaveDialogOptions) => {
    return await showSaveDialog(options)
  })

  ipcMain.handle(IPC_CHANNELS.DIALOG.SHOW_OPEN_DIALOG, async (_, options: OpenDialogOptions) => {
    return await showOpenDialog(options)
  })
}
