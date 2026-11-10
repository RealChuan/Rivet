import { app, type BrowserWindow } from 'electron'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import { transferService } from '../services/transfer/index.js'
import { logger } from '../utils/index.js'
import { getMainWindow } from './main-window.js'

export type CloseReason = 'close' | 'quit'

let pendingReason: CloseReason | null = null
let confirmed = false
let quitting = false

export function isCloseConfirmed(): boolean {
  return confirmed
}

/** 退出流程已经开始：窗口 close 事件不再按托盘行为拦截。 */
export function isQuitting(): boolean {
  return quitting
}

export function markQuitting(): void {
  quitting = true
}

export function resetCloseGuard(): void {
  pendingReason = null
  confirmed = false
  quitting = false
}

/** 托盘菜单「退出」：跳过活跃传输确认，直接进入退出清理。 */
export function forceQuit(): void {
  pendingReason = null
  confirmed = true
}

/**
 * 有活跃任务时把关闭意图交给渲染层；没有窗口可问时退化为不拦截。
 */
export function requestClose(win: BrowserWindow | undefined, reason: CloseReason): boolean {
  if (confirmed) return false
  if (!transferService.hasActiveTasks()) return false
  if (!win || win.isDestroyed()) {
    logger.warn('Close blocked by active tasks, but no window is available to confirm')
    return false
  }

  pendingReason = reason
  win.webContents.send(EVENT_CHANNEL.CLOSE_REQUESTED, { reason })
  return true
}

export function confirmClose(): void {
  const reason = pendingReason
  pendingReason = null
  confirmed = true

  if (reason === 'quit') {
    app.quit()
  } else {
    getMainWindow()?.close()
  }
}
