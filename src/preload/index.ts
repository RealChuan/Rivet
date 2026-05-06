import { contextBridge } from 'electron'
import { electronAPI } from './api.js'

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
