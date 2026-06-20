import { ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '@shared/constants/index.js'
import { listenerManager } from './listener-manager.js'

export const windowAPI = {
  minimize: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW.MINIMIZE)
  },

  maximize: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW.MAXIMIZE)
  },

  close: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW.CLOSE)
  },

  quit: (): void => {
    ipcRenderer.send(IPC_CHANNELS.WINDOW.QUIT)
  },

  getState: (): Promise<{ isMaximized: boolean; platform: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW.GET_STATE)
  },

  onStateChange: (callback: (state: { isMaximized: boolean }) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, state: { isMaximized: boolean }) => {
      callback(state)
    }
    return listenerManager.on(IPC_CHANNELS.WINDOW.STATE_CHANGED, handler)
  },

  createChild: (options: {
    id: string
    route: string
    width?: number
    height?: number
    title?: string
  }): Promise<string> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW.CREATE_CHILD, options)
  },

  closeChild: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW.CLOSE_CHILD, id)
  },

  getMeta: (): Promise<{ windowId: string; route: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW.GET_META) as Promise<{
      windowId: string
      route: string
    }>
  },

  refreshMeta: async (): Promise<{ windowId: string; route: string }> => {
    return ipcRenderer.invoke(IPC_CHANNELS.WINDOW.GET_META) as Promise<{
      windowId: string
      route: string
    }>
  },
}
