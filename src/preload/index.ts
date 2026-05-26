/**
 * Rivet Preload 脚本入口
 *
 * 安全原则：
 * - 仅通过 contextBridge 暴露白名单 API
 * - 禁止直接暴露 ipcRenderer 对象
 * - 所有通信使用 send/invoke/on 的包装器
 */

import { contextBridge } from 'electron'
import { protocolAPI } from './protocol.js'
import { configAPI } from './config.js'
import { dialogAPI } from './dialog.js'
import { hostKeyAPI } from './host-key.js'
import { systemAPI } from './system.js'
import { utilsAPI } from './utils.js'
import { windowAPI } from './window.js'

contextBridge.exposeInMainWorld('electronAPI', {
  protocol: protocolAPI,
  config: configAPI,
  dialog: dialogAPI,
  hostKey: hostKeyAPI,
  system: systemAPI,
  utils: utilsAPI,
  window: windowAPI,
  windowMeta: windowAPI.getMeta(),
  refreshWindowMeta: windowAPI.refreshMeta,
})
