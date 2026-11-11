import { describe, expect, it, vi } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { Entry } from '@shared/domain/entry.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type {
  S3ClientPort,
  S3ListPage,
  S3MultipartPart,
  S3ObjectSummary,
  S3ReadHandle,
} from './client.js'
import { toS3ProviderError } from './error-map.js'
import { normalizeRootPrefix, toListPrefix, toObjectKey, toVirtualPath } from './paths.js'
import { createS3Provider, S3_PART_SIZE } from './provider.js'

const ACCESS_KEY: Credentials = {
  kind: 'accessKey',
  accessKeyId: 'testkey',
  secretAccessKey: 'testsecret',
}

function config(overrides: Partial<ConnectionConfig> = {}): ConnectionConfig {
  return {
    id: 's3-test',
    name: 'S3 test',
    protocol: 's3',
    host: '127.0.0.1',
    port: 9000,
    username: 'testkey',
    authKind: 'accessKey',
    bucket: 'rivet',
    region: 'us-east-1',
    pathStyle: true,
    ...overrides,
  }
}

interface StoredObject {
  body: Uint8Array
  lastModified: number
}

/** 只实现 provider 真正用到的那部分 S3 语义，够覆盖目录/前缀/分片即可。 */
class MemoryS3Client implements S3ClientPort {
  readonly objects = new Map<string, StoredObject>()
  readonly uploads = new Map<string, { key: string; parts: Map<number, Uint8Array> }>()
  readonly aborted: string[] = []
  closed = false

  seed(key: string, body: string | Uint8Array): void {
    const bytes = typeof body === 'string' ? new TextEncoder().encode(body) : body
    this.objects.set(key, { body: bytes, lastModified: 1_700_000_000_000 })
  }

  private sortedKeys(): string[] {
    return [...this.objects.keys()].sort((left, right) => left.localeCompare(right))
  }

  private page(prefix: string, delimiter: string): S3ListPage {
    const objects: S3ObjectSummary[] = []
    const prefixes = new Set<string>()

    for (const key of this.sortedKeys()) {
      if (!key.startsWith(prefix)) continue
      const rest = key.slice(prefix.length)
      if (delimiter !== '' && rest.includes(delimiter)) {
        prefixes.add(`${prefix}${rest.slice(0, rest.indexOf(delimiter) + 1)}`)
        continue
      }
      const stored = this.objects.get(key)
      if (!stored) continue
      objects.push({ key, size: stored.body.byteLength, lastModified: stored.lastModified })
    }

    return { objects, prefixes: [...prefixes], nextToken: undefined }
  }

  listPage(input: { prefix: string; delimiter: string; maxKeys: number }): Promise<S3ListPage> {
    return Promise.resolve(this.page(input.prefix, input.delimiter))
  }

  headObject(key: string): Promise<S3ObjectSummary | null> {
    const stored = this.objects.get(key)
    if (!stored) return Promise.resolve(null)
    return Promise.resolve({
      key,
      size: stored.body.byteLength,
      lastModified: stored.lastModified,
    })
  }

  getObject(key: string, opts: { start?: number }): Promise<S3ReadHandle> {
    const stored = this.objects.get(key)
    if (!stored) return Promise.reject(new Error(`missing object: ${key}`))
    const body = opts.start === undefined ? stored.body : stored.body.slice(opts.start)
    return Promise.resolve({
      stream: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(body)
          controller.close()
        },
      }),
      close: () => Promise.resolve(),
    })
  }

  putObject(key: string, body: Uint8Array): Promise<void> {
    this.seed(key, body)
    return Promise.resolve()
  }

  deleteObject(key: string): Promise<void> {
    this.objects.delete(key)
    return Promise.resolve()
  }

  deleteObjects(keys: readonly string[]): Promise<void> {
    for (const key of keys) this.objects.delete(key)
    return Promise.resolve()
  }

  copyObject(from: string, to: string): Promise<void> {
    const stored = this.objects.get(from)
    if (!stored) return Promise.reject(new Error(`missing object: ${from}`))
    this.objects.set(to, { body: stored.body, lastModified: stored.lastModified })
    return Promise.resolve()
  }

  createMultipartUpload(key: string): Promise<string> {
    const uploadId = `upload-${key}-${this.uploads.size + 1}`
    this.uploads.set(uploadId, { key, parts: new Map() })
    return Promise.resolve(uploadId)
  }

  uploadPart(input: { uploadId: string; partNumber: number; body: Uint8Array }): Promise<string> {
    const upload = this.uploads.get(input.uploadId)
    if (!upload) return Promise.reject(new Error(`missing upload: ${input.uploadId}`))
    upload.parts.set(input.partNumber, input.body.slice())
    return Promise.resolve(`etag-${input.partNumber}`)
  }

  completeMultipartUpload(input: {
    key: string
    uploadId: string
    parts: readonly S3MultipartPart[]
  }): Promise<void> {
    const upload = this.uploads.get(input.uploadId)
    if (!upload) return Promise.reject(new Error(`missing upload: ${input.uploadId}`))

    const chunks = input.parts.map((part) => upload.parts.get(part.partNumber) ?? new Uint8Array(0))
    const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0)
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }

    this.seed(input.key, merged)
    this.uploads.delete(input.uploadId)
    return Promise.resolve()
  }

  abortMultipartUpload(input: { key: string; uploadId: string }): Promise<void> {
    this.aborted.push(input.uploadId)
    this.uploads.delete(input.uploadId)
    return Promise.resolve()
  }

  readonly presigned: Array<{ key: string; expiresInSeconds: number }> = []

  presignGet(key: string, expiresInSeconds: number): Promise<string> {
    this.presigned.push({ key, expiresInSeconds })
    return Promise.resolve(`https://example.com/${key}?expires=${expiresInSeconds}`)
  }

  close(): Promise<void> {
    this.closed = true
    return Promise.resolve()
  }
}

function makeProvider(client: MemoryS3Client, overrides: Partial<ConnectionConfig> = {}) {
  return createS3Provider({
    config: config(overrides),
    createClient: () => client,
  })
}

async function connect(client: MemoryS3Client, overrides: Partial<ConnectionConfig> = {}) {
  const provider = makeProvider(client, overrides)
  await provider.connect(ACCESS_KEY)
  return provider
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const next = await reader.read()
    if (next.done) break
    chunks.push(next.value)
  }
  return new TextDecoder().decode(new Uint8Array(chunks.flatMap((chunk) => [...chunk])))
}

async function listAll(
  provider: ReturnType<typeof createS3Provider>,
  path: string,
): Promise<Entry[]> {
  const entries: Entry[] = []
  for await (const entry of provider.list(path, { signal: new AbortController().signal })) {
    entries.push(entry)
  }
  return entries
}

describe('s3 paths', () => {
  it('把 basePath 规范成不带首尾斜杠的前缀', () => {
    expect(normalizeRootPrefix('/photos/2024/')).toBe('photos/2024')
    expect(normalizeRootPrefix(undefined)).toBe('')
    expect(normalizeRootPrefix('/')).toBe('')
  })

  it('UI 路径与 key 互转', () => {
    expect(toObjectKey('photos', '/a/b.txt')).toBe('photos/a/b.txt')
    expect(toObjectKey('photos', '/')).toBe('photos')
    expect(toObjectKey('', '/a.txt')).toBe('a.txt')
    expect(toListPrefix('photos', '/a')).toBe('photos/a/')
    expect(toListPrefix('', '/')).toBe('')
    expect(toVirtualPath('photos', 'photos/a/b.txt')).toBe('/a/b.txt')
    expect(toVirtualPath('photos', 'photos')).toBe('/')
    expect(toVirtualPath('photos', 'other/a.txt')).toBeNull()
  })
})

describe('s3 error map', () => {
  it('按 S3 Code 映射错误码并保留服务端消息', () => {
    const error = Object.assign(new Error('The specified key does not exist.'), {
      name: 'NoSuchKey',
      Code: 'NoSuchKey',
      $metadata: { httpStatusCode: 404 },
    })

    const mapped = toS3ProviderError(error, 'stat')
    expect(mapped.code).toBe(ERROR_CODE.NOT_FOUND)
    expect(mapped.detail).toEqual({ serverMessage: 'NoSuchKey: The specified key does not exist.' })
  })

  it('签名错误映射为 AUTH_ERROR，未知错误退回 CONN_FAILED', () => {
    expect(
      toS3ProviderError(
        Object.assign(new Error('bad signature'), {
          name: 'SignatureDoesNotMatch',
          $metadata: { httpStatusCode: 403 },
        }),
        'list',
      ).code,
    ).toBe(ERROR_CODE.AUTH_ERROR)

    expect(toS3ProviderError(new Error('boom'), 'list').code).toBe(ERROR_CODE.CONN_FAILED)
  })

  it('中断映射为 REQUEST_ABORTED', () => {
    const abort = new Error('aborted')
    abort.name = 'AbortError'
    expect(toS3ProviderError(abort, 'upload').code).toBe(ERROR_CODE.REQUEST_ABORTED)
  })
})

describe('s3 provider', () => {
  it('connect 只接受 accessKey 凭据', async () => {
    const provider = makeProvider(new MemoryS3Client())
    await expect(
      provider.connect({ kind: 'password', username: 'a', password: 'b' }),
    ).rejects.toMatchObject({ code: ERROR_CODE.INVALID_CONFIG })
  })

  it('上报对象存储的能力快照', async () => {
    const provider = await connect(new MemoryS3Client())
    expect(provider.capabilities).toEqual({
      chmod: false,
      symlink: false,
      serverSideCopy: true,
      serverSideMove: true,
      atomicRename: false,
      dirIsEntity: false,
      caseSensitive: true,
    })
  })

  it('分享链接按桶内 key 签名，有效期透传', async () => {
    const client = new MemoryS3Client()
    client.seed('root/a.txt', 'a')
    const provider = await connect(client, { basePath: 'root' })

    const url = await provider.presign?.('/a.txt', { expiresInSeconds: 600 })

    expect(client.presigned).toEqual([{ key: 'root/a.txt', expiresInSeconds: 600 }])
    expect(url).toContain('root/a.txt')
  })

  it('列举时合并对象与虚目录，并把目录标记对象当目录', async () => {
    const client = new MemoryS3Client()
    client.seed('a.txt', 'a')
    client.seed('docs/', '')
    client.seed('docs/b.txt', 'b')
    client.seed('photos/2024/c.jpg', 'c')

    const provider = await connect(client)
    const entries = await listAll(provider, '/')

    expect(entries.map((entry) => [entry.name, entry.kind]).sort()).toEqual([
      ['a.txt', 'file'],
      ['docs', 'directory'],
      ['photos', 'directory'],
    ])
    expect(entries.find((entry) => entry.name === 'a.txt')?.path).toBe('/a.txt')
  })

  it('对象与同名前缀并存时按目录处理，避免整棵子树不可达', async () => {
    const client = new MemoryS3Client()
    client.seed('a', 'file named a')
    client.seed('a/b.txt', 'b')

    const provider = await connect(client)
    const entries = await listAll(provider, '/')

    expect(entries.map((entry) => [entry.name, entry.kind])).toEqual([['a', 'directory']])
  })

  it('跨页列举不丢条目', async () => {
    const client = new MemoryS3Client()
    const provider = await connect(client)
    const pages: S3ListPage[] = [
      {
        objects: [{ key: 'one.txt', size: 1, lastModified: 0 }],
        prefixes: [],
        nextToken: 'p2',
      },
      {
        objects: [{ key: 'two.txt', size: 2, lastModified: 0 }],
        prefixes: [],
        nextToken: undefined,
      },
    ]
    const listPage = vi.fn(() =>
      Promise.resolve(pages.shift() ?? { objects: [], prefixes: [], nextToken: undefined }),
    )
    client.listPage = listPage

    const names = (await listAll(provider, '/')).map((entry) => entry.name)
    expect(names).toEqual(['one.txt', 'two.txt'])
    expect(listPage).toHaveBeenCalledTimes(2)
  })

  it('stat 区分文件、目录与缺失', async () => {
    const client = new MemoryS3Client()
    client.seed('docs/b.txt', 'b')

    const provider = await connect(client)
    await expect(provider.stat('/docs')).resolves.toMatchObject({ kind: 'directory' })
    await expect(provider.stat('/docs/b.txt')).resolves.toMatchObject({
      kind: 'file',
      size: 1,
    })
    await expect(provider.stat('/missing.txt')).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    })
  })

  it('mkdir 写零字节目录标记', async () => {
    const client = new MemoryS3Client()
    const provider = await connect(client)

    await provider.mkdir('/empty', { recursive: true })

    expect(client.objects.has('empty/')).toBe(true)
    expect(await listAll(provider, '/')).toEqual([
      { name: 'empty', kind: 'directory', size: 0, mtime: 0, path: '/empty' },
    ])
  })

  it('删除文件与整棵前缀', async () => {
    const client = new MemoryS3Client()
    client.seed('a.txt', 'a')
    client.seed('tree/b.txt', 'b')
    client.seed('tree/deep/c.txt', 'c')

    const provider = await connect(client)
    await provider.remove('/a.txt')
    expect(client.objects.has('a.txt')).toBe(false)

    await provider.remove('/tree')
    expect(client.objects.size).toBe(0)
  })

  it('rename 用 copy+delete，目录递归处理', async () => {
    const client = new MemoryS3Client()
    client.seed('tree/b.txt', 'b')

    const provider = await connect(client)
    await provider.rename('/tree', '/moved')

    expect([...client.objects.keys()]).toEqual(['moved/b.txt'])
    await expect(provider.stat('/moved')).resolves.toMatchObject({ kind: 'directory' })
  })

  it('拒绝把目录复制进自身', async () => {
    const client = new MemoryS3Client()
    client.seed('tree/b.txt', 'b')

    const provider = await connect(client)
    if (provider.copy === undefined) throw new Error('S3 provider 应支持服务端复制')
    await expect(provider.copy('/tree', '/tree/nested')).rejects.toMatchObject({
      code: ERROR_CODE.PATH_ERROR,
    })
  })

  it('小文件经一次分片完成，内容与字节数一致', async () => {
    const client = new MemoryS3Client()
    const provider = await connect(client)

    const handle = await provider.openWrite('/small.txt', { overwrite: true })
    const writer = handle.stream.getWriter()
    await writer.write(new TextEncoder().encode('hello world'))
    await writer.close()
    await handle.commit()

    expect(client.uploads.size).toBe(0)
    expect(new TextDecoder().decode(client.objects.get('small.txt')?.body)).toBe('hello world')
  })

  it('跨过 8 MiB 边界时分成两片', async () => {
    const client = new MemoryS3Client()
    const provider = await connect(client)

    const handle = await provider.openWrite('/big.bin', { overwrite: true })
    const writer = handle.stream.getWriter()
    await writer.write(new Uint8Array(S3_PART_SIZE))
    await writer.write(new Uint8Array(1))
    await writer.close()
    await handle.commit()

    expect(client.objects.get('big.bin')?.body.byteLength).toBe(S3_PART_SIZE + 1)
    expect(client.uploads.size).toBe(0)
  })

  it('0 字节文件退回 PutObject，不留下分片', async () => {
    const client = new MemoryS3Client()
    const provider = await connect(client)

    const handle = await provider.openWrite('/empty.txt', { overwrite: true })
    await handle.stream.getWriter().close()
    await handle.commit()

    expect(client.objects.get('empty.txt')?.body.byteLength).toBe(0)
    expect(client.uploads.size).toBe(0)
    expect(client.aborted).toHaveLength(1)
  })

  it('overwrite:false 且目标存在时报 ALREADY_EXISTS', async () => {
    const client = new MemoryS3Client()
    client.seed('exists.txt', 'x')

    const provider = await connect(client)
    await expect(provider.openWrite('/exists.txt', { overwrite: false })).rejects.toMatchObject({
      code: ERROR_CODE.ALREADY_EXISTS,
    })
  })

  it('abort 清理分片上传', async () => {
    const client = new MemoryS3Client()
    const provider = await connect(client)

    const handle = await provider.openWrite('/aborted.txt', { overwrite: true })
    await handle.stream.getWriter().write(new Uint8Array(16))
    await handle.abort()

    expect(client.uploads.size).toBe(0)
    expect(client.aborted).toHaveLength(1)
    expect(client.objects.has('aborted.txt')).toBe(false)
  })

  it('openRead 支持从偏移读取', async () => {
    const client = new MemoryS3Client()
    client.seed('file.txt', '0123456789')

    const provider = await connect(client)
    const handle = await provider.openRead('/file.txt', { start: 4 })

    expect(await readAll(handle.stream)).toBe('456789')
    await handle.close()
  })

  it('basePath 把桶内前缀当作根目录', async () => {
    const client = new MemoryS3Client()
    client.seed('photos/a.jpg', 'a')
    client.seed('other.txt', 'x')

    const provider = await connect(client, { basePath: '/photos' })
    const entries = await listAll(provider, '/')

    expect(entries.map((entry) => entry.name)).toEqual(['a.jpg'])
  })
})
