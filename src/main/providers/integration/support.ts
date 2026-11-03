import { randomUUID } from 'node:crypto'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { FileProvider } from '../types.js'
import { ProviderError } from '../errors.js'

export function assertIntegrationEnabled(): void {
  if (process.env.RIVET_INTEGRATION !== '1') {
    throw new Error(
      '真实服务集成测试需要显式开启：先启动 SFTP/WebDAV 服务，再设置 RIVET_INTEGRATION=1',
    )
  }
}

export function env(name: string, fallback: string): string {
  const value = process.env[name]
  return value === undefined || value === '' ? fallback : value
}

export function optionalEnv(name: string): string | undefined {
  const value = process.env[name]
  return value === undefined || value === '' ? undefined : value
}

export function envNumber(name: string, fallback: number): number {
  const raw = env(name, String(fallback))
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`${name} 必须是 1-65535 的整数，当前为 ${raw}`)
  }
  return value
}

export function envBoolean(name: string, fallback: boolean): boolean {
  const raw = optionalEnv(name)
  if (raw === undefined) return fallback

  const normalized = raw.toLowerCase()
  if (normalized === '1' || normalized === 'true') return true
  if (normalized === '0' || normalized === 'false') return false
  throw new Error(`${name} 只接受 1/0 或 true/false，当前为 ${raw}`)
}

export function workspacePath(prefix: string): string {
  return `/${prefix}-${randomUUID()}`
}

export async function removeQuietly(provider: FileProvider, path: string): Promise<void> {
  try {
    await provider.remove(path)
  } catch (error) {
    if (error instanceof ProviderError && error.code === ERROR_CODE.NOT_FOUND) return
    throw error
  }
}

export async function listNames(provider: FileProvider, path: string): Promise<string[]> {
  const names: string[] = []
  for await (const entry of provider.list(path, { signal: new AbortController().signal })) {
    names.push(entry.name)
  }
  return names
}

export async function writeRemoteFile(
  provider: FileProvider,
  path: string,
  content: Buffer,
  overwrite: boolean,
): Promise<void> {
  const handle = await provider.openWrite(path, { overwrite })
  const writer = handle.stream.getWriter()

  try {
    await writer.write(content)
    await writer.close()
    await handle.commit()
  } catch (error) {
    await handle.abort()
    throw error
  }
}

export async function readRemoteFile(
  provider: FileProvider,
  path: string,
  start?: number,
): Promise<Buffer> {
  const handle = await provider.openRead(path, start === undefined ? {} : { start })
  const reader = handle.stream.getReader()
  const chunks: Uint8Array[] = []

  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      chunks.push(result.value)
    }
  } finally {
    await handle.close()
  }

  return Buffer.concat(chunks)
}
