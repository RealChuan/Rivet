import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { JsonStore } from './json-store.js'

const schema = z.object({
  schemaVersion: z.literal(1),
  value: z.number(),
})

type FileShape = z.infer<typeof schema>

function defaultFile(): FileShape {
  return { schemaVersion: 1, value: 0 }
}

describe('JsonStore', () => {
  let dir: string
  let filePath: string
  let store: JsonStore<FileShape>

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rivet-json-store-'))
    filePath = join(dir, 'settings.json')
    store = new JsonStore({ filePath, schema, createDefault: defaultFile, debounceMs: 20 })
  })

  afterEach(async () => {
    await store.dispose()
    rmSync(dir, { recursive: true, force: true })
  })

  it('returns defaults when the file does not exist and writes them', async () => {
    expect(store.get()).toEqual({ schemaVersion: 1, value: 0 })

    await store.flush()

    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual({ schemaVersion: 1, value: 0 })
  })

  it('backs up invalid JSON and rebuilds defaults', () => {
    writeFileSync(filePath, '{not json', 'utf8')
    store = new JsonStore({ filePath, schema, createDefault: defaultFile, debounceMs: 20 })

    expect(store.get()).toEqual({ schemaVersion: 1, value: 0 })
    expect(existsSync(`${filePath}.bak`)).toBe(true)
  })

  it('backs up a file whose schemaVersion does not match', () => {
    writeFileSync(filePath, JSON.stringify({ schemaVersion: 2, value: 9 }), 'utf8')
    store = new JsonStore({ filePath, schema, createDefault: defaultFile, debounceMs: 20 })

    expect(store.get()).toEqual({ schemaVersion: 1, value: 0 })
    expect(existsSync(`${filePath}.bak`)).toBe(true)
  })

  it('coalesces set calls and writes once', async () => {
    store.set({ schemaVersion: 1, value: 1 })
    store.set({ schemaVersion: 1, value: 2 })

    await store.flush()

    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual({ schemaVersion: 1, value: 2 })
    expect(existsSync(`${filePath}.tmp`)).toBe(false)
  })

  it('does not let callers mutate the stored value', () => {
    const value = store.get()
    value.value = 99

    expect(store.get().value).toBe(0)
  })

  it('update applies a function to the current value', async () => {
    store.update((current) => ({ ...current, value: current.value + 3 }))
    await store.flush()

    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual({ schemaVersion: 1, value: 3 })
  })
})
