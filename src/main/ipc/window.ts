import { BrowserWindow } from 'electron'
import { windowContract, windowOneWayContract } from '@shared/contract/window.contract.js'
import { ok } from '@shared/types/index.js'
import { registerContractWithSender, registerOneWay } from './register.js'

function windowOf(sender: Electron.WebContents): BrowserWindow | null {
  return BrowserWindow.fromWebContents(sender)
}

export function setupWindowIpcHandlers(): void {
  registerContractWithSender(windowContract, {
    'window.getState': (sender) => ok({ isMaximized: windowOf(sender)?.isMaximized() ?? false }),
  })

  registerOneWay(windowOneWayContract, {
    'window.minimize': (sender) => {
      windowOf(sender)?.minimize()
    },
    'window.toggleMaximize': (sender) => {
      const win = windowOf(sender)
      if (!win) return
      if (win.isMaximized()) win.unmaximize()
      else win.maximize()
    },
    'window.close': (sender) => {
      windowOf(sender)?.close()
    },
  })
}
