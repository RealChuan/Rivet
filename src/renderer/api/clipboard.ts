import { unwrap } from './result.js'

export const clipboardApi = {
  writeText: async (text: string): Promise<void> => {
    unwrap(await window.electronAPI.clipboard.writeText(text))
  },

  readText: async (): Promise<string> => unwrap(await window.electronAPI.clipboard.readText()),
}
