import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { getConfigurationValue, setConfigurationValue } from '../stores/index.js'

export function setupConfigIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.CONFIG.GET, (_, key: string) => {
    return getConfigurationValue(key)
  })

  ipcMain.handle(IPC_CHANNELS.CONFIG.SET, (_, key: string, value: unknown) => {
    return setConfigurationValue(key, value)
  })
}
