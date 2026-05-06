import { safeStorage } from 'electron'
/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig } from '@shared/types/index.js'
import {
  deleteConnectionSecret,
  disposeConnections,
  flushConnections,
  getConnectionSecret,
  getConnections,
  initializeConnections,
  replaceConnections,
  saveConnectionSecret,
} from './connections-repository.js'

const connection: ConnectionConfig = {
  id: 'c1',
  name: 'Test',
  protocol: 'sftp',
  host: 'example.com',
  port: 22,
  username: 'user',
  authKind: 'password',
}

describe('connections-repository', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rivet-connections-'))
    initializeConnections(dir)
  })

  afterEach(async () => {
    await disposeConnections()
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns an empty list when connections.json is missing', () => {
    expect(getConnections()).toEqual([])
  })

  it('persists valid records and strips unknown fields', async () => {
    replaceConnections([connection])
    await flushConnections()

    expect(getConnections()).toEqual([
      { ...connection, secretRef: undefined, askPasswordOnConnect: true },
    ])
  })

  it('reports INVALID_CONFIG on a bad array', () => {
    const result = replaceConnections([{ id: '' } as ConnectionConfig])

    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.code).toBe('INVALID_CONFIG')
  })

  it('does not persist secrets when safeStorage is unavailable', async () => {
    vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(false)
    replaceConnections([connection])

    const result = await saveConnectionSecret('c1', 'pw')

    expect(result).toEqual({ success: true, value: { stored: false }, error: null })
    expect(getConnections()[0]?.askPasswordOnConnect).toBe(true)
  })

  it('stores, derives secretRef and deletes the secret', async () => {
    vi.mocked(safeStorage.isAsyncEncryptionAvailable).mockResolvedValue(true)
    vi.mocked(safeStorage.encryptStringAsync).mockResolvedValue(Buffer.from('encrypted'))
    vi.mocked(safeStorage.decryptStringAsync).mockResolvedValue({
      result: 'pw',
      shouldReEncrypt: false,
    })
    replaceConnections([connection])

    expect(await saveConnectionSecret('c1', 'pw')).toEqual({
      success: true,
      value: { stored: true },
      error: null,
    })
    expect(getConnections()[0]?.secretRef).toBe('c1')
    expect(getConnections()[0]?.askPasswordOnConnect).toBe(false)
    expect(await getConnectionSecret('c1')).toEqual({
      success: true,
      value: 'pw',
      error: null,
    })

    deleteConnectionSecret('c1')

    expect(getConnections()[0]?.secretRef).toBeUndefined()
    expect(getConnections()[0]?.askPasswordOnConnect).toBe(true)
  })
})
