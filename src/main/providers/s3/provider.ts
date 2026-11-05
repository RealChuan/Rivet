import type { Credentials } from '@shared/domain/credentials.js'
import type { Capabilities, Entry } from '@shared/domain/entry.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { isSubPath, joinPaths, normalizePath, pathBasename } from '@shared/utils/index.js'
import type { FileProvider, ReadHandle, WriteHandle } from '../types.js'
import type { S3ClientPort, S3MultipartPart } from './client.js'
import { ProviderError } from '../errors.js'
import { normalizeRootPrefix, toListPrefix, toObjectKey } from './paths.js'

export interface S3ProviderOptions {
  config: ConnectionConfig
  createClient: (config: ConnectionConfig, credentials: Credentials) => S3ClientPort
}

/** S3 的最小分片 5 MiB，取 8 MiB 留出余量也压低分片数量。 */
export const S3_PART_SIZE = 8 * 1024 * 1024
const LIST_PAGE_SIZE = 1000
const CONTENT_TYPE = 'application/octet-stream'
const EMPTY_BODY = new Uint8Array(0)

/**
 * 对象存储的能力快照：没有 chmod/symlink，也没有原子 rename。
 * `dirIsEntity=false` 让 UI 知道目录的大小与时间不可信。
 */
const CAPABILITIES: Capabilities = {
  chmod: false,
  symlink: false,
  serverSideCopy: true,
  serverSideMove: true,
  atomicRename: false,
  dirIsEntity: false,
  caseSensitive: true,
}

type ResolvedKind = 'file' | 'directory' | 'missing'

export function createS3Provider(options: S3ProviderOptions): FileProvider {
  const rootPrefix = normalizeRootPrefix(options.config.basePath)
  let client: S3ClientPort | null = null

  function getClient(): S3ClientPort {
    if (!client) {
      throw new ProviderError(ERROR_CODE.INVALID_STATE, 'S3 provider is not connected')
    }
    return client
  }

  function signalOption(signal: AbortSignal | undefined): { signal?: AbortSignal } {
    return signal === undefined ? {} : { signal }
  }

  function directoryEntry(path: string): Entry {
    const normalized = normalizePath(path)
    const name = normalized === '/' ? pathBasename(rootPrefix) || '/' : pathBasename(normalized)
    return { name, kind: 'directory', size: 0, mtime: 0, path: normalized }
  }

  /** 前缀下是否存在任何 key：目录标记对象也算。 */
  async function hasChildren(key: string, signal?: AbortSignal): Promise<boolean> {
    const page = await getClient().listPage({
      prefix: `${key}/`,
      delimiter: '/',
      maxKeys: 1,
      ...signalOption(signal),
    })
    return page.objects.length > 0 || page.prefixes.length > 0
  }

  /** 目录优先：`a` 对象与 `a/` 前缀并存时按目录处理，否则整棵子树在 UI 里不可达。 */
  async function resolveKind(key: string, signal?: AbortSignal): Promise<ResolvedKind> {
    if (await hasChildren(key, signal)) return 'directory'
    const head = await getClient().headObject(key, signal)
    return head === null ? 'missing' : 'file'
  }

  async function* listKeys(prefix: string, signal?: AbortSignal): AsyncGenerator<string> {
    let token: string | undefined
    do {
      const page = await getClient().listPage({
        prefix,
        delimiter: '',
        maxKeys: LIST_PAGE_SIZE,
        ...(token === undefined ? {} : { token }),
        ...signalOption(signal),
      })
      for (const object of page.objects) yield object.key
      token = page.nextToken
    } while (token !== undefined)
  }

  async function removeTree(prefix: string, signal?: AbortSignal): Promise<void> {
    let batch: string[] = []
    for await (const key of listKeys(prefix, signal)) {
      batch.push(key)
      if (batch.length >= LIST_PAGE_SIZE) {
        await getClient().deleteObjects(batch, signal)
        batch = []
      }
    }
    if (batch.length > 0) await getClient().deleteObjects(batch, signal)
  }

  async function copyTree(
    fromPrefix: string,
    toPrefix: string,
    signal?: AbortSignal,
  ): Promise<void> {
    for await (const key of listKeys(fromPrefix, signal)) {
      const target = `${toPrefix}${key.slice(fromPrefix.length)}`
      // 目录标记是零字节对象，直接重建即可：SeaweedFS 之类实现对尾斜杠 key 的
      // CopyObject 会返回 NoSuchKey。
      if (key.endsWith('/')) {
        await getClient().putObject(target, EMPTY_BODY, signal)
        continue
      }
      await getClient().copyObject(key, target, signal)
    }
  }

  async function copyPath(from: string, to: string, signal?: AbortSignal): Promise<void> {
    const fromPath = normalizePath(from)
    const toPath = normalizePath(to)
    if (isSubPath(fromPath, toPath)) {
      throw new ProviderError(ERROR_CODE.PATH_ERROR, 'Cannot copy a path into itself')
    }

    const fromKey = toObjectKey(rootPrefix, fromPath)
    const toKey = toObjectKey(rootPrefix, toPath)
    const kind = await resolveKind(fromKey, signal)

    if (kind === 'missing') {
      throw new ProviderError(ERROR_CODE.NOT_FOUND, `not found: ${fromPath}`)
    }
    if (kind === 'file') {
      await getClient().copyObject(fromKey, toKey, signal)
      return
    }
    await copyTree(`${fromKey}/`, `${toKey}/`, signal)
  }

  return {
    kind: 's3',
    capabilities: CAPABILITIES,

    connect: async (credentials, signal) => {
      signal?.throwIfAborted()
      if (credentials.kind !== 'accessKey') {
        throw new ProviderError(
          ERROR_CODE.INVALID_CONFIG,
          `S3 does not support ${credentials.kind} authentication`,
        )
      }

      if (client) {
        await client.close()
        client = null
      }
      client = options.createClient(options.config, credentials)
    },

    disconnect: async () => {
      const current = client
      client = null
      if (current) await current.close()
    },

    ping: async (signal) => {
      await getClient().listPage({
        prefix: toListPrefix(rootPrefix, '/'),
        delimiter: '/',
        maxKeys: 1,
        ...signalOption(signal),
      })
    },

    list: (path, opts) => {
      const activeClient = getClient()
      const prefix = toListPrefix(rootPrefix, path)

      return (async function* listEntries(): AsyncGenerator<Entry> {
        let token: string | undefined
        do {
          const page = await activeClient.listPage({
            prefix,
            delimiter: '/',
            maxKeys: LIST_PAGE_SIZE,
            ...(token === undefined ? {} : { token }),
            signal: opts.signal,
          })

          // 目录标记对象（`a/`）会与 CommonPrefixes 重复出现，统一按目录处理。
          const folders = new Set(page.prefixes)

          for (const object of page.objects) {
            if (object.key.endsWith('/')) continue
            // 同名冲突时目录优先：CommonPrefix 带结尾斜杠，对象 key 不带。
            if (folders.has(`${object.key}/`)) continue
            const name = object.key.slice(prefix.length)
            if (name === '' || name.includes('/')) continue
            yield {
              name,
              kind: 'file',
              size: object.size,
              mtime: object.lastModified,
              path: joinPaths(path, name),
            }
          }

          for (const folder of page.prefixes) {
            const name = folder.slice(prefix.length).replace(/\/$/, '')
            if (name === '' || name.includes('/')) continue
            yield {
              name,
              kind: 'directory',
              size: 0,
              mtime: 0,
              path: joinPaths(path, name),
            }
          }

          token = page.nextToken
        } while (token !== undefined)
      })()
    },

    stat: async (path, signal) => {
      const normalized = normalizePath(path)
      if (normalized === '/') return directoryEntry('/')

      const key = toObjectKey(rootPrefix, normalized)
      if (await hasChildren(key, signal)) return directoryEntry(normalized)

      const head = await getClient().headObject(key, signal)
      if (head !== null) {
        return {
          name: pathBasename(normalized),
          kind: 'file',
          size: head.size,
          mtime: head.lastModified,
          path: normalized,
        }
      }

      throw new ProviderError(ERROR_CODE.NOT_FOUND, `not found: ${normalized}`)
    },

    mkdir: async (path, opts) => {
      const normalized = normalizePath(path)
      if (normalized === '/') return
      // 零字节的 `<key>/` 标记让空目录可见；S3 没有真正的目录。
      await getClient().putObject(
        `${toObjectKey(rootPrefix, normalized)}/`,
        EMPTY_BODY,
        opts.signal,
      )
    },

    remove: async (path, signal) => {
      const normalized = normalizePath(path)
      if (normalized === '/') {
        throw new ProviderError(ERROR_CODE.NOT_SUPPORTED, 'Cannot delete the bucket root')
      }

      const key = toObjectKey(rootPrefix, normalized)
      const kind = await resolveKind(key, signal)

      if (kind === 'file') {
        await getClient().deleteObject(key, signal)
        return
      }
      if (kind === 'directory') {
        await removeTree(`${key}/`, signal)
        return
      }

      throw new ProviderError(ERROR_CODE.NOT_FOUND, `not found: ${normalized}`)
    },

    rename: async (from, to, signal) => {
      const fromPath = normalizePath(from)
      const toPath = normalizePath(to)
      const kind = await resolveKind(toObjectKey(rootPrefix, fromPath), signal)

      if (kind === 'missing') {
        throw new ProviderError(ERROR_CODE.NOT_FOUND, `not found: ${fromPath}`)
      }

      // 目录 rename 是 copy+delete：S3 没有 rename，中断会留下部分副本。
      await copyPath(fromPath, toPath, signal)

      if (kind === 'file') {
        await getClient().deleteObject(toObjectKey(rootPrefix, fromPath), signal)
        return
      }
      await removeTree(`${toObjectKey(rootPrefix, fromPath)}/`, signal)
    },

    copy: async (from, to, signal) => {
      await copyPath(from, to, signal)
    },

    openRead: async (path, opts): Promise<ReadHandle> => {
      const key = toObjectKey(rootPrefix, normalizePath(path))
      const handle = await getClient().getObject(key, {
        ...(opts.start === undefined ? {} : { start: opts.start }),
        ...signalOption(opts.signal),
      })
      return { stream: handle.stream, close: () => handle.close() }
    },

    openWrite: async (path, opts): Promise<WriteHandle> => {
      const activeClient = getClient()
      const normalized = normalizePath(path)
      const key = toObjectKey(rootPrefix, normalized)

      if (!opts.overwrite) {
        const existing = await activeClient.headObject(key, opts.signal)
        if (existing !== null) {
          throw new ProviderError(ERROR_CODE.ALREADY_EXISTS, `already exists: ${normalized}`)
        }
      }

      const uploadId = await activeClient.createMultipartUpload(key, CONTENT_TYPE, opts.signal)
      const parts: S3MultipartPart[] = []
      let buffer = new Uint8Array(S3_PART_SIZE)
      let filled = 0
      let partNumber = 1
      let uploadedBytes = 0
      let finished = false

      const flush = async (): Promise<void> => {
        if (filled === 0) return
        const etag = await activeClient.uploadPart({
          key,
          uploadId,
          partNumber,
          body: buffer.subarray(0, filled),
          ...signalOption(opts.signal),
        })
        parts.push({ partNumber, etag })
        partNumber += 1
        uploadedBytes += filled
        buffer = new Uint8Array(S3_PART_SIZE)
        filled = 0
      }

      const stream = new WritableStream<Uint8Array>({
        write: async (chunk) => {
          let offset = 0
          while (offset < chunk.byteLength) {
            const room = S3_PART_SIZE - filled
            const take = Math.min(room, chunk.byteLength - offset)
            buffer.set(chunk.subarray(offset, offset + take), filled)
            filled += take
            offset += take
            if (filled === S3_PART_SIZE) await flush()
          }
        },
      })

      return {
        stream,
        commit: async () => {
          if (finished) return
          try {
            if (uploadedBytes === 0 && filled === 0) {
              // 0 字节对象不能靠分片完成，退回 PutObject。
              await activeClient.abortMultipartUpload({ key, uploadId })
              await activeClient.putObject(key, EMPTY_BODY, opts.signal)
            } else {
              await flush()
              await activeClient.completeMultipartUpload({
                key,
                uploadId,
                parts,
                ...signalOption(opts.signal),
              })
            }
            finished = true
          } catch (error) {
            // 完成后失败也必须清理分片，否则残留分片会持续计费。
            await activeClient.abortMultipartUpload({ key, uploadId })
            finished = true
            throw error
          }
        },
        abort: async () => {
          if (finished) return
          finished = true
          await activeClient.abortMultipartUpload({ key, uploadId })
        },
      }
    },
  }
}
