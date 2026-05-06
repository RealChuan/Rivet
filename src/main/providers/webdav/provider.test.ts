import { describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { WebdavHttpPort, WebdavHttpRequestOptions, WebdavHttpResponse } from './http.js'
import { ProviderError } from '../errors.js'
import { createWebdavProvider } from './provider.js'

const config: ConnectionConfig = {
  id: 'c1',
  name: 'dav',
  protocol: 'webdav',
  host: 'dav.example.com',
  port: 443,
  username: 'u',
  basePath: '/dav',
}

const credentials: Credentials = { kind: 'password', username: 'u', password: 'p' }

interface RecordedRequest {
  method: string
  path: string
  opts: WebdavHttpRequestOptions | undefined
}

function textResponse(
  status: number,
  text = '',
  headers: Record<string, string> = {},
): WebdavHttpResponse {
  const encoder = new TextEncoder()
  return {
    status,
    headers,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(text))
        controller.close()
      },
    }),
    text: () => Promise.resolve(text),
  }
}

function makeHarness(
  handler: (request: RecordedRequest) => WebdavHttpResponse | Promise<WebdavHttpResponse>,
) {
  const requests: RecordedRequest[] = []
  const http: WebdavHttpPort = {
    request: vi.fn((method: string, path: string, opts?: WebdavHttpRequestOptions) => {
      const request: RecordedRequest = { method, path, opts }
      requests.push(request)
      return Promise.resolve(handler(request))
    }),
    close: vi.fn(() => Promise.resolve()),
  }
  const createHttp = vi.fn((_credentials: Credentials) => http)
  const provider = createWebdavProvider({ config, createHttp })
  return { provider, http, createHttp, requests }
}

function multistatus(entries: string): string {
  return `<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${entries}</d:multistatus>`
}

function entryXml(href: string, options: { dir?: boolean; size?: number } = {}): string {
  return `<d:response><d:href>${href}</d:href><d:propstat><d:prop>${
    options.dir ? '<d:resourcetype><d:collection/></d:resourcetype>' : '<d:resourcetype/>'
  }<d:getcontentlength>${options.size ?? 0}</d:getcontentlength><d:getlastmodified>Wed, 21 Oct 2026 07:28:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`
}

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = []
  for await (const item of iterable) result.push(item)
  return result
}

const signal = new AbortController().signal

describe('createWebdavProvider', () => {
  it('connect 只接受密码认证，非法类型不创建 HTTP 客户端', async () => {
    const { provider, createHttp } = makeHarness(() => textResponse(200))

    await expect(
      provider.connect({ kind: 'privateKey', username: 'u', privateKeyPath: '/k' }),
    ).rejects.toMatchObject({ code: ERROR_CODE.INVALID_CONFIG })
    await expect(provider.connect({ kind: 'agent', username: 'u' })).rejects.toMatchObject({
      code: ERROR_CODE.INVALID_CONFIG,
    })
    expect(createHttp).not.toHaveBeenCalled()

    await provider.connect(credentials)
    expect(createHttp).toHaveBeenCalledWith(credentials)
  })

  it('报告 WebDAV 能力快照', async () => {
    const { provider } = makeHarness(() => textResponse(200))
    await provider.connect(credentials)

    expect(provider.kind).toBe('webdav')
    expect(provider.capabilities).toEqual({
      chmod: false,
      symlink: false,
      serverSideCopy: true,
      serverSideMove: true,
      atomicRename: true,
      dirIsEntity: true,
      caseSensitive: false,
    })
  })

  it('list 用 PROPFIND Depth:1 并按 basePath 映射回虚拟路径', async () => {
    const { provider, requests } = makeHarness(() =>
      textResponse(
        207,
        multistatus(
          entryXml('/dav/') +
            entryXml('/dav/a%20b.txt', { size: 3 }) +
            entryXml('/dav/sub', { dir: true }),
        ),
      ),
    )
    await provider.connect(credentials)

    const entries = await collect(provider.list('/', { signal }))

    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('PROPFIND')
    expect(requests[0]?.path).toBe('/dav')
    expect(requests[0]?.opts?.headers).toMatchObject({ depth: '1' })
    expect(entries).toEqual([
      {
        name: 'a b.txt',
        kind: 'file',
        size: 3,
        mtime: Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'),
        path: '/a b.txt',
      },
      {
        name: 'sub',
        kind: 'directory',
        size: 0,
        mtime: Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'),
        path: '/sub',
      },
    ])
  })

  it('stat 用 PROPFIND Depth:0 并保留目标自身', async () => {
    const { provider, requests } = makeHarness(() =>
      textResponse(207, multistatus(entryXml('/dav/a.txt', { size: 7 }))),
    )
    await provider.connect(credentials)

    const entry = await provider.stat('/a.txt', signal)

    expect(requests[0]?.method).toBe('PROPFIND')
    expect(requests[0]?.path).toBe('/dav/a.txt')
    expect(requests[0]?.opts?.headers).toMatchObject({ depth: '0' })
    expect(entry).toMatchObject({ name: 'a.txt', kind: 'file', size: 7, path: '/a.txt' })
  })

  it('mkdir recursive 逐段 MKCOL，405 视为已存在', async () => {
    let call = 0
    const { provider, requests } = makeHarness(() => {
      call++
      if (call === 1) throw new ProviderError(ERROR_CODE.NOT_SUPPORTED, '405')
      return textResponse(201)
    })
    await provider.connect(credentials)

    await provider.mkdir('/a/b', { recursive: true, signal })

    expect(requests.map((item) => [item.method, item.path])).toEqual([
      ['MKCOL', '/dav'],
      ['MKCOL', '/dav/a'],
      ['MKCOL', '/dav/a/b'],
    ])
  })

  it('remove 用 DELETE', async () => {
    const { provider, requests } = makeHarness(() => textResponse(204))
    await provider.connect(credentials)

    await provider.remove('/a.txt', signal)

    expect(requests[0]).toMatchObject({ method: 'DELETE', path: '/dav/a.txt' })
  })

  it('rename 用 MOVE + Destination + Overwrite:T', async () => {
    const { provider, requests } = makeHarness(() => textResponse(201))
    await provider.connect(credentials)

    await provider.rename('/a b.txt', '/sub/c d.txt', signal)

    expect(requests[0]).toMatchObject({ method: 'MOVE', path: '/dav/a b.txt' })
    expect(requests[0]?.opts?.headers).toMatchObject({
      destination: '/dav/sub/c%20d.txt',
      overwrite: 'T',
    })
  })

  it('copy 用 COPY + Destination', async () => {
    const { provider, requests } = makeHarness(() => textResponse(201))
    await provider.connect(credentials)

    await provider.copy?.('/a.txt', '/b.txt', signal)

    expect(requests[0]).toMatchObject({ method: 'COPY', path: '/dav/a.txt' })
    expect(requests[0]?.opts?.headers).toMatchObject({ destination: '/dav/b.txt' })
  })

  it('openRead 发送 Range 并返回可读流', async () => {
    const encoder = new TextEncoder()
    const { provider, requests } = makeHarness(() => ({
      status: 206,
      headers: {},
      body: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('hello'))
          controller.close()
        },
      }),
      text: () => Promise.resolve('hello'),
    }))
    await provider.connect(credentials)

    const handle = await provider.openRead('/a.txt', { start: 10, signal })
    const reader = handle.stream.getReader()
    let received = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      received += new TextDecoder().decode(value)
    }

    expect(requests[0]?.method).toBe('GET')
    expect(requests[0]?.path).toBe('/dav/a.txt')
    expect(requests[0]?.opts?.headers).toMatchObject({ range: 'bytes=10-' })
    expect(received).toBe('hello')
    await handle.close()
  })

  it('openWrite 写临时路径，commit 用 MOVE 落到目标', async () => {
    const { provider, requests } = makeHarness(() => textResponse(201))
    await provider.connect(credentials)

    const handle = await provider.openWrite('/a.txt', { overwrite: true, signal })
    const writer = handle.stream.getWriter()
    await writer.write(new TextEncoder().encode('data'))
    await writer.close()
    await handle.commit()

    expect(requests[0]).toMatchObject({ method: 'PUT' })
    expect(requests[0]?.path).toMatch(/^\/dav\/\.a\.txt\.[0-9a-f-]+\.rivet-tmp$/)
    expect(requests[1]).toMatchObject({ method: 'MOVE', path: requests[0]?.path })
    expect(requests[1]?.opts?.headers).toMatchObject({
      destination: '/dav/a.txt',
      overwrite: 'T',
    })
  })

  it('openWrite abort 删除临时路径', async () => {
    const { provider, requests } = makeHarness(() => textResponse(201))
    await provider.connect(credentials)

    const handle = await provider.openWrite('/a.txt', { overwrite: true, signal })
    await handle.abort()

    const deleteRequest = requests.find((item) => item.method === 'DELETE')
    expect(deleteRequest?.path).toMatch(/^\/dav\/\.a\.txt\.[0-9a-f-]+\.rivet-tmp$/)
  })

  it('PUT 失败后拒绝继续写入，commit 抛出原始错误码', async () => {
    const { provider } = makeHarness((request) => {
      if (request.method === 'PUT') {
        return Promise.reject(
          new ProviderError(ERROR_CODE.AUTH_ERROR, 'WebDAV request failed with status 401'),
        )
      }
      return textResponse(204)
    })
    await provider.connect(credentials)

    const handle = await provider.openWrite('/a.txt', { overwrite: true, signal })
    const writer = handle.stream.getWriter()

    await expect(writer.write(new TextEncoder().encode('data'))).rejects.toMatchObject({
      code: ERROR_CODE.AUTH_ERROR,
    })
    await expect(handle.commit()).rejects.toMatchObject({ code: ERROR_CODE.AUTH_ERROR })

    await handle.abort()
  })

  it('目标已存在且 overwrite:false 抛 ALREADY_EXISTS', async () => {
    const { provider } = makeHarness(() =>
      textResponse(207, multistatus(entryXml('/dav/a.txt', { size: 1 }))),
    )
    await provider.connect(credentials)

    await expect(provider.openWrite('/a.txt', { overwrite: false, signal })).rejects.toMatchObject({
      code: ERROR_CODE.ALREADY_EXISTS,
    })
  })
})
