import { unwrap } from './result.js'

export const windowApi = {
  getState: async (): Promise<{ isMaximized: boolean }> =>
    unwrap(await window.electronAPI.window.getState()),
  minimize: (): void => window.electronAPI.window.minimize(),
  toggleMaximize: (): void => window.electronAPI.window.toggleMaximize(),
  close: (): void => window.electronAPI.window.close(),
  onStateChanged: (callback: (state: { isMaximized: boolean }) => void): (() => void) =>
    window.electronAPI.window.onStateChanged(callback),
}
