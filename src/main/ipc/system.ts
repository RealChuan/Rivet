import crypto from 'node:crypto'
import { systemContract } from '@shared/contract/system.contract.js'
import {
  clearLogCache,
  getDownloadDir,
  getLogCacheSize,
  getLogDir,
  getTempDir,
  openLogDir,
  supportsGlassEffect,
} from '../utils/index.js'
import { registerContract } from './register.js'

export function setupSystemIpcHandlers(): void {
  registerContract(systemContract, {
    'system.getTempDir': () => getTempDir(),
    'system.getDownloadDir': () => getDownloadDir(),
    'system.supportsGlass': () => supportsGlassEffect(),
    'system.generateUuid': () => crypto.randomUUID(),
    'system.getLogDir': () => getLogDir(),
    'system.getLogCacheSize': () => getLogCacheSize(),
    'system.clearLogCache': () => clearLogCache(),
    'system.openLogDir': () => openLogDir(),
  })
}
