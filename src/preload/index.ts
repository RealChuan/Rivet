import { contextBridge } from 'electron'
import { configAPI } from './config.js'
import { cryptoAPI } from './crypto.js'
import { dialogAPI } from './dialog.js'
import { hostKeyAPI } from './host-key.js'
import { protocolAPI } from './protocol.js'
import { systemAPI } from './system.js'
import { transferAPI } from './transfer.js'
import { windowAPI } from './window.js'

contextBridge.exposeInMainWorld('electronAPI', {
  protocol: protocolAPI,
  config: configAPI,
  dialog: dialogAPI,
  hostKey: hostKeyAPI,
  system: systemAPI,
  crypto: cryptoAPI,
  window: windowAPI,
  transfer: transferAPI,
})
