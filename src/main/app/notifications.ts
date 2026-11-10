import { Notification } from 'electron'
import type { TransferOutcome, TransferTask } from '@shared/types/index.js'
import { mainT } from '../i18n/index.js'
import { getMainWindow } from './main-window.js'

/** 前台窗口可见且聚焦时不再打扰：列表里已经能看到结果。 */
export function shouldNotify(): boolean {
  const win = getMainWindow()
  if (!win) return false
  return !win.isFocused() || !win.isVisible()
}

export function notifyTransferFinished(task: TransferTask, outcome: TransferOutcome): void {
  if (!Notification.isSupported() || !shouldNotify()) return

  const detail = outcome === 'failed' && task.errorMessage ? `: ${task.errorMessage}` : ''
  const notification = new Notification({
    title: outcome === 'completed' ? mainT('notification.completed') : mainT('notification.failed'),
    body: `${task.itemName}${detail}`,
  })

  notification.on('click', () => {
    const win = getMainWindow()
    win?.show()
    win?.focus()
  })
  notification.show()
}
