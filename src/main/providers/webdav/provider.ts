import { PassThrough } from 'node:stream'
import type { Credentials } from '@shared/domain/credentials.js'
import type { Capabilities, Entry } from '@shared/domain/entry.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { joinPaths, normalizePath, pathBasename } from '@shared/utils/index.js'
import type { FileProvider, ReadHandle, WriteHandle } from '../types.js'
import { remoteTempPath } from '../../utils/temp-path.js'
import { ProviderError } from '../errors.js'
import { encodePath, type WebdavHttpPort, type WebdavHttpResponse } from './http.js'
import { parseMultistatus, type PropfindEntry } from './xml.js'

export interface WebdavProviderOptions {
  config: ConnectionConfig
  createHttp: (credentials: Credentials) => WebdavHttpPort
}

const CAPABILITIES: Capabilities = {
  chmod: false,
  symlink: false,
  serverSideCopy: true,
  serverSideMove: true,
  atomicRename: true,
  dirIsEntity: true,
  caseSensitive: false,
}

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:resourcetype/>
    <d:getcontentlength/>
    <d:getlastmodified/>
  </d:prop>
</d:propfind>`

async function drain(response: WebdavHttpResponse): Promise<void> {
  await response.body.cancel().catch(() => {})
}

async function propfind(
  http: WebdavHttpPort,
  serverPath: string,
  depth: '0' | '1',
  signal: AbortSignal | undefined,
): Promise<PropfindEntry[]> {
  const response = await http.request('PROPFIND', serverPath, {
    headers: { depth, 'content-type': 'application/xml; charset=utf-8' },
    body: PROPFIND_BODY,
    ...(signal !== undefined ? { signal } : {}),
  })

  return parseMultistatus(await response.text(), serverPath, {
    includeSelf: depth === '0',
  })
}

async function statServerPath(
  http: WebdavHttpPort,
  serverPath: string,
  signal: AbortSignal | undefined,
): Promise<PropfindEntry> {
  const [prop] = await propfind(http, serverPath, '0', signal)
  if (!prop) {
    throw new ProviderError(ERROR_CODE.NOT_FOUND, `not found: ${serverPath}`)
  }
  return prop
}

function toEntry(prop: PropfindEntry, virtualPath: string): Entry {
  return {
    name: pathBasename(virtualPath),
    kind: prop.isDirectory ? 'directory' : 'file',
    size: prop.size,
    mtime: prop.lastModified,
    path: virtualPath,
  }
}

export function createWebdavProvider(options: WebdavProviderOptions): FileProvider {
  const basePath = normalizePath(options.config.basePath ?? '/')
  let http: WebdavHttpPort | null = null

  function toServerPath(path: string): string {
    return joinPaths(basePath, path)
  }

  function getHttp(): WebdavHttpPort {
    if (!http) {
      throw new ProviderError(ERROR_CODE.INVALID_STATE, 'WebDAV provider is not connected')
    }
    return http
  }

  async function removeQuietly(serverPath: string): Promise<void> {
    try {
      await getHttp().request('DELETE', serverPath)
    } catch {
      // 临时文件清理是尽力而为，失败不影响上层错误。
    }
  }

  return {
    kind: 'webdav',
    capabilities: CAPABILITIES,

    connect: async (credentials) => {
      if (credentials.kind !== 'password') {
        throw new ProviderError(
          ERROR_CODE.INVALID_CONFIG,
          `WebDAV does not support ${credentials.kind} authentication`,
        )
      }

      if (http) await http.close()
      http = options.createHttp(credentials)
    },

    disconnect: async () => {
      const current = http
      http = null
      if (current) await current.close()
    },

    ping: async (signal) => {
      await statServerPath(getHttp(), toServerPath('/'), signal)
    },

    list: async function* (path, opts) {
      const client = getHttp()
      const serverPath = toServerPath(path)
      const props = await propfind(client, serverPath, '1', opts.signal)

      for (const prop of props) {
        opts.signal.throwIfAborted()
        yield {
          name: prop.name,
          kind: prop.isDirectory ? 'directory' : 'file',
          size: prop.size,
          mtime: prop.lastModified,
          path: joinPaths(path, prop.name),
        }
      }
    },

    stat: async (path, signal) => {
      const virtualPath = normalizePath(path)
      const prop = await statServerPath(getHttp(), toServerPath(virtualPath), signal)
      return toEntry(prop, virtualPath)
    },

    mkdir: async (path, opts) => {
      const client = getHttp()
      const serverPath = toServerPath(path)

      if (!opts.recursive) {
        await drain(
          await client.request('MKCOL', serverPath, {
            ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
          }),
        )
        return
      }

      const segments = serverPath.split('/').filter(Boolean)
      const absolute = serverPath.startsWith('/')
      let current = ''
      for (const segment of segments) {
        opts.signal?.throwIfAborted()
        current = current ? `${current}/${segment}` : absolute ? `/${segment}` : segment
        try {
          await drain(
            await client.request('MKCOL', current, {
              ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
            }),
          )
        } catch (error) {
          if (
            error instanceof ProviderError &&
            (error.code === ERROR_CODE.NOT_SUPPORTED || error.code === ERROR_CODE.ALREADY_EXISTS)
          ) {
            continue
          }
          throw error
        }
      }
    },

    remove: async (path, signal) => {
      await drain(
        await getHttp().request('DELETE', toServerPath(path), {
          ...(signal !== undefined ? { signal } : {}),
        }),
      )
    },

    rename: async (from, to, signal) => {
      await drain(
        await getHttp().request('MOVE', toServerPath(from), {
          headers: {
            destination: encodePath(toServerPath(to)),
            overwrite: 'T',
          },
          ...(signal !== undefined ? { signal } : {}),
        }),
      )
    },

    copy: async (from, to, signal) => {
      await drain(
        await getHttp().request('COPY', toServerPath(from), {
          headers: {
            destination: encodePath(toServerPath(to)),
            overwrite: 'T',
          },
          ...(signal !== undefined ? { signal } : {}),
        }),
      )
    },

    openRead: async (path, opts): Promise<ReadHandle> => {
      const response = await getHttp().request('GET', toServerPath(path), {
        headers: opts.start !== undefined ? { range: `bytes=${opts.start}-` } : {},
        ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
      })

      return {
        stream: response.body,
        close: async () => {
          await response.body.cancel().catch(() => {})
        },
      }
    },

    openWrite: async (path, opts): Promise<WriteHandle> => {
      const client = getHttp()
      const target = toServerPath(path)

      if (!opts.overwrite) {
        let exists = true
        try {
          await statServerPath(client, target, opts.signal)
        } catch (error) {
          if (error instanceof ProviderError && error.code === ERROR_CODE.NOT_FOUND) {
            exists = false
          } else {
            throw error
          }
        }
        if (exists) {
          throw new ProviderError(ERROR_CODE.ALREADY_EXISTS, `target exists: ${path}`)
        }
      }

      const tempPath = remoteTempPath(target)
      const body = new PassThrough()
      const controller = new AbortController()
      const onAbort = (): void => controller.abort(opts.signal?.reason)
      opts.signal?.addEventListener('abort', onAbort, { once: true })
      if (opts.signal?.aborted) controller.abort(opts.signal.reason)

      let putFailure: Error | null = null
      let aborted = false
      const recordFailure = (error: unknown): void => {
        putFailure ??=
          error instanceof Error ? error : new ProviderError(ERROR_CODE.UPLOAD_ERROR, String(error))
      }

      // undici 在响应完成后会移除自己的 body error 监听；
      // 没有这里的兜底，迟到的流错误会变成 uncaughtException 并让主进程直接退出。
      body.on('error', recordFailure)

      const putOutcome = client
        .request('PUT', tempPath, { body, signal: controller.signal })
        .then((response) => drain(response), recordFailure)

      const cleanup = (): void => {
        opts.signal?.removeEventListener('abort', onAbort)
      }

      return {
        stream: new WritableStream<Uint8Array>({
          write: (chunk) => {
            // PUT 一失败就立刻拒绝后续写入，让 pipeTo 中止本地读取，
            // 否则剩余文件会全部堆在一个没人消费的 PassThrough 里（大文件直接 OOM 闪退）。
            if (putFailure) return Promise.reject(putFailure)
            if (body.destroyed) {
              return Promise.reject(
                new ProviderError(ERROR_CODE.UPLOAD_ERROR, 'WebDAV upload stream was closed'),
              )
            }

            return new Promise<void>((resolve, reject) => {
              body.write(chunk, (error) => {
                if (error) reject(error)
                else resolve()
              })
            })
          },
          close: () =>
            new Promise<void>((resolve) => {
              if (body.writableEnded || body.destroyed) {
                resolve()
                return
              }
              body.end(() => resolve())
            }),
          abort: () => {
            body.destroy()
            controller.abort()
          },
        }),

        commit: async () => {
          try {
            if (!body.writableEnded && !body.destroyed) body.end()
            await putOutcome

            if (putFailure) throw putFailure

            try {
              await drain(
                await client.request('MOVE', tempPath, {
                  headers: {
                    destination: encodePath(target),
                    overwrite: opts.overwrite ? 'T' : 'F',
                  },
                  ...(opts.signal !== undefined ? { signal: opts.signal } : {}),
                }),
              )
            } catch (error) {
              await removeQuietly(tempPath)
              throw error
            }
          } finally {
            cleanup()
          }
        },

        abort: async () => {
          if (aborted) return
          aborted = true
          cleanup()
          body.destroy()
          controller.abort()
          await putOutcome.catch(() => {})
          await removeQuietly(tempPath)
        },
      }
    },
  }
}
