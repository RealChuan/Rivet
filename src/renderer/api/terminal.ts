import type { OpenTerminalRequest, TerminalExitInfo } from '@shared/types/index.js'
import { unwrap } from './result.js'

export const terminalApi = {
  open: async (request: OpenTerminalRequest): Promise<{ terminalId: string }> =>
    unwrap(await window.electronAPI.terminal.open(request)),

  close: async (terminalId: string): Promise<void> => {
    unwrap(await window.electronAPI.terminal.close(terminalId))
  },

  /** 单向通道：按键输入不等待往返，失败只会表现为终端无响应。 */
  write: (terminalId: string, data: Uint8Array): void => {
    window.electronAPI.terminal.write(terminalId, data)
  },

  resize: (terminalId: string, cols: number, rows: number): void => {
    window.electronAPI.terminal.resize(terminalId, cols, rows)
  },

  onData: (callback: (payload: { terminalId: string; data: Uint8Array }) => void): (() => void) =>
    window.electronAPI.terminal.onData(callback),

  onExit: (callback: (info: TerminalExitInfo) => void): (() => void) =>
    window.electronAPI.terminal.onExit(callback),
}
