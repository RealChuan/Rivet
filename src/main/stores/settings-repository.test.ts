import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SORT_ORDER } from '@shared/constants/index.js'
import {
  disposeSettings,
  flushSettings,
  getConnectionSortOrder,
  getTransferSettings,
  getUiSettings,
  initializeSettings,
  setConnectionSortOrder,
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

    await flushSettings()

    const file = JSON.parse(readFileSync(join(dir, 'settings.json'), 'utf8')) as {
      schemaVersion: number
    }
    expect(file.schemaVersion).toBe(1)
  })

  it('persists ui, transfer and sortOrder', async () => {
    setUiSettings({ appearance: 'dark', locale: 'en-US' })
    setTransferSettings({ maxUploadConcurrency: 8, maxDownloadConcurrency: 7 })
    setConnectionSortOrder(SORT_ORDER.DESC)
    await flushSettings()

    expect(getUiSettings()).toEqual({ appearance: 'dark', locale: 'en-US' })
    expect(getTransferSettings()).toEqual({
      maxUploadConcurrency: 8,
      maxDownloadConcurrency: 7,
    })
    expect(getConnectionSortOrder()).toBe(SORT_ORDER.DESC)
  })

  it('clamps concurrency into MIN/MAX before writing', () => {
    const result = setTransferSettings({ maxUploadConcurrency: 99, maxDownloadConcurrency: 0 })

    expect(result.success).toBe(true)
    expect(getTransferSettings()).toEqual({
      maxUploadConcurrency: 10,
      maxDownloadConcurrency: 1,
    })
  })
})
