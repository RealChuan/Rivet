import path from 'node:path'
import { ERROR_CODE } from '@shared/constants/index.js'
import { knownHostsFileSchema, type KnownHostsFile } from '@shared/schemas/config.js'
import {
  createErrorInfo,
  err,
  type ErrorInfo,
  type HostKeyTrustRequest,
  type KnownHostRecord,
  ok,
  type Result,
} from '@shared/types/index.js'
import { logger } from '../utils/index.js'
import { JsonStore } from './json-store.js'

let knownHostsStore: JsonStore<KnownHostsFile> | null = null

function requireStore(): JsonStore<KnownHostsFile> {
  if (!knownHostsStore) {
    throw new Error('known-hosts store is not initialized')
  }
  return knownHostsStore
}

function normalizeHost(host: string): string {
  return host.trim().toLowerCase()
}

export function initializeKnownHosts(baseDir: string): void {
  knownHostsStore = new JsonStore<KnownHostsFile>({
    filePath: path.join(baseDir, 'known-hosts.json'),
    schema: knownHostsFileSchema,
    createDefault: () => ({ schemaVersion: 1, hosts: [] }),
  })
}

export function getKnownHost(
  host: string,
  port: number,
  algorithm: string,
): Result<KnownHostRecord | undefined, ErrorInfo> {
  try {
    const target = normalizeHost(host)
    const record = requireStore()
      .get()
      .hosts.find(
        (entry) =>
          normalizeHost(entry.host) === target &&
          entry.port === port &&
          entry.algorithm === algorithm,
      )
    return ok(record ? { ...record } : undefined)
  } catch (error) {
    logger.catch(error, { host, port, algorithm, action: 'get-known-host' })
    return err(createErrorInfo(ERROR_CODE.HOST_KEY_ERROR, 'Failed to read known host'))
  }
}

export function trustHostKey(input: HostKeyTrustRequest): Result<void, ErrorInfo> {
  try {
    const host = normalizeHost(input.host)
    requireStore().update((current) => {
      const hosts = current.hosts.filter(
        (entry) =>
          !(
            normalizeHost(entry.host) === host &&
            entry.port === input.port &&
            entry.algorithm === input.algorithm
          ),
      )
      hosts.push({
        host,
        port: input.port,
        algorithm: input.algorithm,
        fingerprint: input.fingerprint,
        createdAt: Date.now(),
      })
      return { ...current, hosts }
    })
    logger.info(`Trusted host key for ${host}:${input.port} (${input.algorithm})`)
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { host: input.host, port: input.port, action: 'trust-known-host' })
    return err(createErrorInfo(ERROR_CODE.HOST_KEY_ERROR, 'Failed to save host key'))
  }
}

export async function flushKnownHosts(): Promise<void> {
  await knownHostsStore?.flush()
}

export async function disposeKnownHosts(): Promise<void> {
  await knownHostsStore?.dispose()
  knownHostsStore = null
}
