import type { Dispatcher } from 'undici'
import http from 'node:http'
import { describe, expect, it, vi } from 'vitest'
import { createDispatcher, WebdavHttpClient } from './http.js'

function basic(username: string, password: string): string {
  return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
}

async function startServer(
  handler: http.RequestListener,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server = http.createServer(handler)
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('server address unavailable')

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve())
      }),
  }
}

describe('WebdavHttpClient', () => {
  it('默认发送 Basic 认证并返回 207', async () => {
    let authorization: string | undefined
    const server = await startServer((request, response) => {
      authorization = request.headers.authorization
      response.writeHead(207, { 'content-type': 'application/xml' })
      response.end('<multistatus/>')
    })
    const client = new WebdavHttpClient({
      baseUrl: server.baseUrl,
      username: 'user',
      password: 'pass',
      rejectUnauthorized: true,
    })

    try {
      const result = await client.request('PROPFIND', '/dav')
      expect(result.status).toBe(207)
      expect(result.headers['content-type']).toBe('application/xml')
      expect(authorization).toBe(basic('user', 'pass'))
      expect(await result.text()).toContain('multistatus')
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('401 Digest challenge 后只重试一次并使用 Digest', async () => {
    let count = 0
    let secondAuthorization: string | undefined
    const server = await startServer((request, response) => {
      count++
      if (count === 1) {
        response.writeHead(401, {
          'www-authenticate': 'Digest realm="test", nonce="abc", qop="auth", algorithm=MD5',
        })
        response.end()
        return
      }
      secondAuthorization = request.headers.authorization
      response.writeHead(207)
      response.end('<multistatus/>')
    })
    const client = new WebdavHttpClient({
      baseUrl: server.baseUrl,
      username: 'user',
      password: 'pass',
      rejectUnauthorized: true,
    })

    try {
      const result = await client.request('PROPFIND', '/dav')
      expect(result.status).toBe(207)
      expect(count).toBe(2)
      expect(secondAuthorization).toContain('Digest username="user"')
      expect(secondAuthorization).toContain('uri="/dav"')
      expect(secondAuthorization).toContain('response="')
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('Digest 的 uri 与请求行使用同一份编码路径', async () => {
    let count = 0
    let seenUrl: string | undefined
    let seenUri: string | undefined
    const server = await startServer((request, response) => {
      count++
      if (count === 1) {
        response.writeHead(401, {
          'www-authenticate': 'Digest realm="test", nonce="abc", qop="auth", algorithm=MD5',
        })
        response.end()
        return
      }

      seenUrl = request.url
      seenUri = /uri="([^"]*)"/.exec(request.headers.authorization ?? '')?.[1]
      // 服务端按请求行里的 request-target 计算摘要；uri 不一致时必须继续拒绝。
      if (seenUri !== seenUrl) {
        response.writeHead(401)
        response.end()
        return
      }

      response.writeHead(207)
      response.end('<multistatus/>')
    })
    const client = new WebdavHttpClient({
      baseUrl: server.baseUrl,
      username: 'user',
      password: 'pass',
      rejectUnauthorized: true,
    })

    try {
      const result = await client.request('PROPFIND', '/dav/中文 文件#1.txt')
      expect(result.status).toBe(207)
      expect(seenUri).toBe('/dav/%E4%B8%AD%E6%96%87%20%E6%96%87%E4%BB%B6%231.txt')
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('错误响应正文进入 message 与 detail.serverMessage', async () => {
    const server = await startServer((_request, response) => {
      response.writeHead(405, { 'content-type': 'text/html' })
      response.end('<html><body>Method\nNot Allowed</body></html>')
    })
    const client = new WebdavHttpClient({
      baseUrl: server.baseUrl,
      username: 'user',
      password: 'pass',
      rejectUnauthorized: true,
    })

    try {
      const request = client.request('MKCOL', '/dav')
      await expect(request).rejects.toMatchObject({
        code: 'NOT_SUPPORTED',
        detail: { serverMessage: 'Method Not Allowed' },
      })
      await expect(request).rejects.toThrow(/Method Not Allowed/)
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('404 映射为 NOT_FOUND', async () => {
    const server = await startServer((_request, response) => {
      response.writeHead(404)
      response.end()
    })
    const client = new WebdavHttpClient({
      baseUrl: server.baseUrl,
      username: 'user',
      password: 'pass',
      rejectUnauthorized: true,
    })

    try {
      await expect(client.request('GET', '/missing')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('signal 中止映射为 REQUEST_ABORTED', async () => {
    const server = await startServer((_request, response) => {
      setTimeout(() => {
        response.writeHead(207)
        response.end('<multistatus/>')
      }, 50)
    })
    const client = new WebdavHttpClient({
      baseUrl: server.baseUrl,
      username: 'user',
      password: 'pass',
      rejectUnauthorized: true,
    })
    const controller = new AbortController()
    const pending = client.request('PROPFIND', '/dav', { signal: controller.signal })
    const assertion = expect(pending).rejects.toMatchObject({ code: 'REQUEST_ABORTED' })

    controller.abort()

    await assertion
    await client.close()
    await server.close()
  })

  it('createDispatcher 把 rejectUnauthorized 传给工厂', () => {
    const dispatcher = { dispatch: vi.fn(), close: vi.fn() } as unknown as Dispatcher
    const factory = vi.fn(() => dispatcher)

    expect(createDispatcher(false, factory)).toBe(dispatcher)
    expect(factory).toHaveBeenCalledWith({ connect: { rejectUnauthorized: false } })
  })
})
