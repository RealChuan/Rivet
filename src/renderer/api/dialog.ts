import { unwrap } from './result.js'

interface OpenDialogOptions {
  properties: string[]
  defaultPath?: string | undefined
}

interface SaveDialogOptions {
  defaultPath?: string | undefined
}

export const dialogApi = {
  showOpenDialog: async (options: OpenDialogOptions) =>
    unwrap(await window.electronAPI.dialog.showOpenDialog(options)),

  showSaveDialog: async (options: SaveDialogOptions) =>
    unwrap(await window.electronAPI.dialog.showSaveDialog(options)),

  /** 同步 `webUtils` 调用，不进 IPC。 */
  getPathForFile: (file: File): string => window.electronAPI.dialog.getPathForFile(file),
}
