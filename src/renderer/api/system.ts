import { unwrap } from './result.js'

export const systemApi = {
  getTempDir: async (): Promise<string> => unwrap(await window.electronAPI.system.getTempDir()),

  getDownloadDir: async (): Promise<string> =>
    unwrap(await window.electronAPI.system.getDownloadDir()),

  supportsGlass: async (): Promise<boolean> => window.electronAPI.system.supportsGlass(),

  generateUuid: async (): Promise<string> => window.electronAPI.system.generateUuid(),
}
