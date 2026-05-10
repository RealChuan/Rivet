import { contextBridge } from 'electron'
import { protocolAPI, type ProtocolAPI } from './protocol-preload.js'
import { commonAPI, type CommonAPI } from './common-preload.js'

interface ElectronAPI {
  protocol: ProtocolAPI
  common: CommonAPI
}

const electronAPI: ElectronAPI = {
  protocol: protocolAPI,
  common: commonAPI,
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
