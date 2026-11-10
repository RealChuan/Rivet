import { Menu, Tray } from 'electron'
import { APP_NAME } from '@shared/constants/index.js'
import { mainT } from '../i18n/index.js'
import { logger } from '../utils/index.js'
import { createTrayImage } from './tray-icon.js'

export interface TrayHandlers {
  onShow: () => void
  onQuit: () => void
}

let tray: Tray | null = null
let handlers: TrayHandlers | null = null

function applyMenu(): void {
  if (!tray) return
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: mainT('tray.show'), click: () => handlers?.onShow() },
      { type: 'separator' },
      { label: mainT('tray.quit'), click: () => handlers?.onQuit() },
    ]),
  )
}

/** 语言切换后由 IPC 层调用，用新语言重建菜单。 */
export function refreshTrayMenu(): void {
  applyMenu()
}

export function setupTray(next: TrayHandlers): void {
  handlers = next

  if (tray) {
    applyMenu()
    return
  }

  try {
    tray = new Tray(createTrayImage())
  } catch (error) {
    logger.catch(error, { action: 'create-tray' })
    tray = null
    return
  }

  tray.setToolTip(APP_NAME)
  applyMenu()
  tray.on('click', () => handlers?.onShow())
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
