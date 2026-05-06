import type { BrowserWindow } from 'electron'
import type { EVENT_CHANNEL } from '@shared/contract/events.contract.js'

export type EventChannel = (typeof EVENT_CHANNEL)[keyof typeof EVENT_CHANNEL]

let mainWindow: BrowserWindow | null = null

export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

export function getMainWindow(): BrowserWindow | undefined {
  if (!mainWindow || mainWindow.isDestroyed()) return undefined
  return mainWindow
}

export function sendToMainWindow(channel: EventChannel, payload: unknown): void {
  const win = getMainWindow()
  if (win) {
    win.webContents.send(channel, payload)
  }
}
