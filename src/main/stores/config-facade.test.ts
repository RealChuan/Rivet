import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SORT_ORDER, STORE_KEY } from '@shared/constants/index.js'
import { getConfigurationValue, setConfigurationValue } from './config-facade.js'
import { disposeStores, initializeStores } from './index.js'

describe('config-facade', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rivet-config-'))
    initializeStores(dir)
  })

  afterEach(async () => {
    await disposeStores()
    rmSync(dir, { recursive: true, force: true })
  })

  it('reads ui, transfer, connections and sortOrder', () => {
    expect(getConfigurationValue(STORE_KEY.UI).success).toBe(true)
    expect(getConfigurationValue(STORE_KEY.TRANSFER).success).toBe(true)
    expect(getConfigurationValue(STORE_KEY.CONNECTIONS)).toEqual({
      success: true,
      value: [],
      error: null,
    })
    expect(getConfigurationValue(STORE_KEY.CONNECTION_SORT_ORDER)).toEqual({
      success: true,
      value: SORT_ORDER.NONE,
      error: null,
    })
  })

  it('rejects unknown keys and invalid values', () => {
    expect(getConfigurationValue('nope').success).toBe(false)
    expect(setConfigurationValue(STORE_KEY.UI, { appearance: 'neon' }).success).toBe(false)
    expect(setConfigurationValue(STORE_KEY.CONNECTIONS, {}).success).toBe(false)
  })
})
