import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SORT_ORDER, TRANSFER_CONFIG } from '@shared/constants/index.js'
import {
  disposeSettings,
  flushSettings,
  getConnectionSortOrder,
  getFavorites,
  getLastPaths,
  getTransferSettings,
  getUiSettings,
  initializeSettings,
  setConnectionSortOrder,
  setFavorites,
  setLastPaths,
  setTransferSettings,
  setUiSettings,
} from './settings-repository.js'

describe('settings-repository', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rivet-settings-'))
    initializeSettings(dir)
  })

  afterEach(async () => {
    await disposeSettings()
    rmSync(dir, { recursive: true, force: true })
  })

  it('loads defaults and auto-detects the system language', async () => {
    const ui = getUiSettings()
    expect(ui.appearance).toBe('system')
    expect(ui.locale).toBe('zh-CN')
    expect(ui.closeBehavior).toBe('tray')

    await flushSettings()

    const file = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')) as {
      schemaVersion: number
    }
    expect(file.schemaVersion).toBe(1)
  })

  it('persists ui, transfer and sortOrder', async () => {
    setUiSettings({
      appearance: 'dark',
      locale: 'en-US',
      showHiddenFiles: true,
      closeBehavior: 'quit',
      terminalFontSize: 16,
    })
    setTransferSettings({
      maxUploadConcurrency: 8,
      maxDownloadConcurrency: 7,
      maxUploadBytesPerSecond: 1024 * 1024,
      maxDownloadBytesPerSecond: 0,
    })
    setConnectionSortOrder(SORT_ORDER.DESC)
    await flushSettings()

    expect(getUiSettings()).toEqual({
      appearance: 'dark',
      locale: 'en-US',
      showHiddenFiles: true,
      closeBehavior: 'quit',
      terminalFontSize: 16,
    })
    expect(getTransferSettings()).toEqual({
      maxUploadConcurrency: 8,
      maxDownloadConcurrency: 7,
      maxUploadBytesPerSecond: 1024 * 1024,
      maxDownloadBytesPerSecond: 0,
    })
    expect(getConnectionSortOrder()).toBe(SORT_ORDER.DESC)
  })

  it('persists favorites per connection', () => {
    expect(setFavorites({ c1: ['/a', '/b'] }).success).toBe(true)
    expect(getFavorites()).toEqual({ c1: ['/a', '/b'] })
  })

  it('persists the last path per connection', () => {
    expect(setLastPaths({ c1: '/home/user/work' }).success).toBe(true)
    expect(getLastPaths()).toEqual({ c1: '/home/user/work' })
  })

  it('clamps concurrency into MIN/MAX before writing', () => {
    const result = setTransferSettings({
      maxUploadConcurrency: 99,
      maxDownloadConcurrency: 0,
      maxUploadBytesPerSecond: 0,
      maxDownloadBytesPerSecond: 0,
    })

    expect(result.success).toBe(true)
    expect(getTransferSettings()).toEqual({
      maxUploadConcurrency: 10,
      maxDownloadConcurrency: 1,
      maxUploadBytesPerSecond: 0,
      maxDownloadBytesPerSecond: 0,
    })
  })

  it('clamps speed limits into MIN/MAX before writing', () => {
    setTransferSettings({
      maxUploadConcurrency: 5,
      maxDownloadConcurrency: 5,
      maxUploadBytesPerSecond: -1,
      maxDownloadBytesPerSecond: TRANSFER_CONFIG.MAX_SPEED_LIMIT * 2,
    })

    expect(getTransferSettings()).toMatchObject({
      maxUploadBytesPerSecond: 0,
      maxDownloadBytesPerSecond: TRANSFER_CONFIG.MAX_SPEED_LIMIT,
    })
  })
})
