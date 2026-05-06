import type { z } from 'zod'
import { existsSync, readFileSync, renameSync, unlinkSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import { logger } from '../utils/index.js'

export interface JsonStoreOptions<T> {
  filePath: string
  schema: z.ZodType<T>
  createDefault: () => T
  debounceMs?: number
}

const DEFAULT_DEBOUNCE_MS = 300

/**
 * 单文件 JSON 配置：同步读、去抖原子写、损坏备份 `.bak`。
 * 只被主进程在 app ready 后使用。
 */
export class JsonStore<T> {
  readonly filePath: string
  private readonly schema: z.ZodType<T>
  private readonly createDefault: () => T
  private readonly debounceMs: number
  private value: T
  private timer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private pending: Promise<void> = Promise.resolve()

  constructor(options: JsonStoreOptions<T>) {
    this.filePath = options.filePath
    this.schema = options.schema
    this.createDefault = options.createDefault
    this.debounceMs = options.debounceMs ?? DEFAULT_DEBOUNCE_MS
    this.removeStaleTemp()
    this.value = this.load()
  }

  get(): T {
    return structuredClone(this.value)
  }

  set(next: T): void {
    this.value = structuredClone(this.schema.parse(next))
    this.dirty = true
    this.schedule()
  }

  update(fn: (current: T) => T): void {
    this.set(fn(this.get()))
  }

  async flush(): Promise<void> {
    this.clearTimer()
    if (!this.dirty) return this.pending

    const snapshot = structuredClone(this.value)
    this.dirty = false
    const write = async (): Promise<void> => {
      const tempPath = `${this.filePath}.tmp`
      try {
        await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
        await rename(tempPath, this.filePath)
      } catch (error) {
        this.dirty = true
        logger.catch(error, { action: 'json-store-flush', file: this.filePath })
      }
    }
    this.pending = this.pending.then(write, write)
    return this.pending
  }

  async dispose(): Promise<void> {
    this.clearTimer()
    await this.pending
  }

  private removeStaleTemp(): void {
    const tempPath = `${this.filePath}.tmp`
    if (existsSync(tempPath)) {
      try {
        unlinkSync(tempPath)
      } catch (error) {
        logger.catch(error, { action: 'json-store-remove-temp', file: tempPath })
      }
    }
  }

  private load(): T {
    try {
      const raw = readFileSync(this.filePath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      const result = this.schema.safeParse(parsed)
      if (result.success) return result.data
      logger.warn('Config file failed schema validation, backing up', { file: this.filePath })
      this.backup()
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'ENOENT') {
        logger.warn('Config file is unreadable, backing up', { file: this.filePath })
        this.backup()
      }
    }

    const fallback = this.schema.parse(this.createDefault())
    this.dirty = true
    this.schedule()
    return fallback
  }

  private backup(): void {
    const backupPath = `${this.filePath}.bak`
    try {
      if (existsSync(backupPath)) unlinkSync(backupPath)
      renameSync(this.filePath, backupPath)
    } catch (error) {
      logger.catch(error, { action: 'json-store-backup', file: this.filePath })
    }
  }

  private schedule(): void {
    if (this.timer) return
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, this.debounceMs)
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}
