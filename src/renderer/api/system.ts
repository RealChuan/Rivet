import { unwrap } from './result.js'

export const systemApi = {
  getTempDir: async (): Promise<string> => unwrap(await window.electronAPI.system.getTempDir()),

  getDownloadDir: async (): Promise<string> =>
    unwrap(await window.electronAPI.system.getDownloadDir()),

  supportsGlass: async (): Promise<boolean> => window.electronAPI.system.supportsGlass(),

  generateUuid: async (): Promise<string> => window.electronAPI.system.generateUuid(),

  getLogDir: async (): Promise<string> => unwrap(await window.electronAPI.system.getLogDir()),

  getLogCacheSize: async (): Promise<number> =>
    unwrap(await window.electronAPI.system.getLogCacheSize()),

  clearLogCache: async (): Promise<number> =>
    unwrap(await window.electronAPI.system.clearLogCache()),

  openLogDir: async (): Promise<void> => unwrap(await window.electronAPI.system.openLogDir()),
}
