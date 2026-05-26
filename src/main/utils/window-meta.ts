import type { BrowserWindow } from 'electron'

const windowMetaMap = new WeakMap<BrowserWindow, { windowId: string; route: string }>()

export function registerWindowMeta(win: BrowserWindow, id: string, route: string): void {
  windowMetaMap.set(win, { windowId: id, route })
}

export function unregisterWindowMeta(win: BrowserWindow): void {
  windowMetaMap.delete(win)
}

export function getWindowMeta(win: BrowserWindow): { windowId: string; route: string } | undefined {
  return windowMetaMap.get(win)
}
