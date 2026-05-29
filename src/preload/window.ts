import { ipcRenderer, type IpcRendererEvent } from 'electron'
import { DEFAULT_ROUTE, IPC_CHANNELS, MAIN_WINDOW_ID } from '@shared/constants/index.js'
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

  getMeta: (): { windowId: string; route: string } => {
    const hash = window.location.hash.replace('#', '')
    return {
      windowId: MAIN_WINDOW_ID,
      route: hash || DEFAULT_ROUTE,
    }
  },

  refreshMeta: async (): Promise<{ windowId: string; route: string }> => {
    try {
      return (await ipcRenderer.invoke(IPC_CHANNELS.WINDOW.GET_META)) as {
        windowId: string
        route: string
      }
    } catch {
      const hash = window.location.hash.replace('#', '')
      return {
        windowId: MAIN_WINDOW_ID,
        route: hash || DEFAULT_ROUTE,
      }
    }
  },
}

export type WindowAPI = typeof windowAPI
