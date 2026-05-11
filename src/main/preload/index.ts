/**
 * Rivet Preload 脚本
 *
 * 安全原则：
 * - 仅通过 contextBridge 暴露白名单 API
 * - 禁止直接暴露 ipcRenderer 对象
 * - 所有通信使用 send/invoke/on 的包装器
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { protocolAPI } from './protocol-preload.js'
import { commonAPI } from './common-preload.js'

// ============================================================
// 窗口控制 API
// ============================================================

const windowControl = {
  minimize: (): void => {
    ipcRenderer.send('window-minimize')
  },

  maximize: (): void => {
    ipcRenderer.send('window-maximize')
  },

  close: (): void => {
    ipcRenderer.send('window-close')
  },

  getState: (): Promise<{ isMaximized: boolean; platform: string }> => {
    return ipcRenderer.invoke('window-get-state')
  },

  onStateChange: (callback: (state: { isMaximized: boolean }) => void): (() => void) => {
    const handler = (_: IpcRendererEvent, state: { isMaximized: boolean }) => {
      callback(state)
    }
    ipcRenderer.on('window-state-changed', handler)
    return () => {
      ipcRenderer.removeListener('window-state-changed', handler)
    }
  },

  // ========== 子窗口管理 ==========
  createChild: (options: {
    id: string
    route: string
    width?: number
    height?: number
    title?: string
  }): Promise<string> => {
    return ipcRenderer.invoke('window-create', options)
  },

  closeChild: (id: string): Promise<boolean> => {
    return ipcRenderer.invoke('window-close-by-id', id)
  },
} as const

// ============================================================
// 窗口元数据（从 additionalArguments 解析）
// ============================================================

function getWindowMeta() {
  const args = process.argv
  const idArg = args.find(a => a.startsWith('--window-id='))
  const routeArg = args.find(a => a.startsWith('--route='))
  return {
    windowId: idArg?.replace('--window-id=', '') ?? 'unknown',
    route: routeArg?.replace('--route=', '') ?? '/',
  }
}

// ============================================================
// 暴露到全局
// ============================================================

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  windowControl,
  // 窗口元数据
  windowMeta: getWindowMeta(),
  // 原有 API
  protocol: protocolAPI,
  common: commonAPI,
})
