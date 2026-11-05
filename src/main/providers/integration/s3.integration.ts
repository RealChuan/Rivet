import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { FileProvider } from '../types.js'
import { createProvider } from '../registry.js'
import {
  assertIntegrationEnabled,
  env,
  envBoolean,
  listNames,
  readRemoteFile,
  removeQuietly,
  workspacePath,
} from './support.js'

assertIntegrationEnabled()

const endpoint = new URL(env('RIVET_S3_ENDPOINT', 'http://127.0.0.1:9000'))
const bucket = env('RIVET_S3_BUCKET', 'rivet')
const accessKey = env('RIVET_S3_ACCESS_KEY', 'testuser')
const secretKey = env('RIVET_S3_SECRET_KEY', 'testpass')
const region = env('RIVET_S3_REGION', 'us-east-1')
const scheme = endpoint.protocol === 'https:' ? 'https' : 'http'
const port = endpoint.port === '' ? (scheme === 'https' ? 443 : 80) : Number(endpoint.port)

const config: ConnectionConfig = {
  id: 'integration-s3',
  name: 'S3 integration',
  protocol: 's3',
  host: endpoint.hostname,
  port,
  username: accessKey,
  authKind: 'accessKey',
  bucket,
  region,
  pathStyle: envBoolean('RIVET_S3_PATH_STYLE', true),
  scheme,
  rejectUnauthorized: envBoolean('RIVET_S3_REJECT_UNAUTHORIZED', true),
}

const workspace = workspacePath('s3-integration')

let provider: FileProvider
let connected = false

async function writeFile(path: string, content: Uint8Array, overwrite: boolean): Promise<void> {
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

describe('S3 provider 对真实对象存储', () => {
  beforeAll(async () => {
    provider = createProvider('s3', { config })
    await provider.connect({
      kind: 'accessKey',
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    })
    connected = true
    await provider.mkdir(workspace, { recursive: true })
  })

  afterAll(async () => {
    if (!connected) return
    await removeQuietly(provider, workspace)
    await provider.disconnect()
  })

  it('ping 并列出根目录', async () => {
    await provider.ping()

    const names = await listNames(provider, '/')
    expect(names).toContain(workspace.slice(1))

    const stat = await provider.stat(workspace)
    expect(stat).toMatchObject({ name: workspace.slice(1), kind: 'directory' })
  })

  it('处理中文、空格、百分号、加号与井号', async () => {
    const directory = `${workspace}/文档 资料/2024 年`
    await provider.mkdir(directory, { recursive: true })

    const file = `${directory}/100% a+b #1.txt`
    const content = Buffer.from('hello 世界\n', 'utf8')
    await writeFile(file, content, false)

    const stat = await provider.stat(file)
    expect(stat.name).toBe('100% a+b #1.txt')
    expect(stat.size).toBe(content.byteLength)

    const names = await listNames(provider, directory)
    expect(names).toContain('100% a+b #1.txt')
    expect((await readRemoteFile(provider, file)).equals(content)).toBe(true)
  })

  it('覆盖写替换内容；overwrite:false 时返回 ALREADY_EXISTS', async () => {
    const file = `${workspace}/overwrite.txt`
    await writeFile(file, Buffer.from('first'), false)
    await writeFile(file, Buffer.from('second'), true)

    expect((await readRemoteFile(provider, file)).toString('utf8')).toBe('second')

    await expect(provider.openWrite(file, { overwrite: false })).rejects.toMatchObject({
      code: ERROR_CODE.ALREADY_EXISTS,
    })
  })

  it('rename 用 copy+delete，缺失源返回 NOT_FOUND', async () => {
    const from = `${workspace}/from.txt`
    const to = `${workspace}/to.txt`
    await writeFile(from, Buffer.from('from'), false)

    await provider.rename(from, to)

    expect((await readRemoteFile(provider, to)).toString('utf8')).toBe('from')
    await expect(provider.stat(from)).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND })
    await expect(provider.rename(`${workspace}/missing.txt`, to)).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    })
  })

  it('服务端 COPY 复制文件', async () => {
    const from = `${workspace}/copy-from.txt`
    const to = `${workspace}/copy-to.txt`
    await writeFile(from, Buffer.from('copy'), false)

    if (provider.copy === undefined) throw new Error('S3 provider 应支持 CopyObject')
    await provider.copy(from, to)

    expect((await readRemoteFile(provider, to)).toString('utf8')).toBe('copy')
    expect((await readRemoteFile(provider, from)).toString('utf8')).toBe('copy')
  })

  it('rename 目录时整棵前缀一起搬走', async () => {
    const tree = `${workspace}/tree`
    await provider.mkdir(`${tree}/sub`, { recursive: true })
    await writeFile(`${tree}/sub/a.txt`, Buffer.from('a'), false)

    await provider.rename(tree, `${workspace}/moved`)

    expect(await listNames(provider, `${workspace}/moved/sub`)).toEqual(['a.txt'])
    await expect(provider.stat(tree)).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND })
  })

  it('递归删除非空目录，并把缺失路径映射为 NOT_FOUND', async () => {
    const tree = `${workspace}/remove-me`
    await provider.mkdir(`${tree}/sub`, { recursive: true })
    await writeFile(`${tree}/sub/a.txt`, Buffer.from('a'), false)

    await provider.remove(tree)

    await expect(provider.stat(tree)).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND })
    expect(await listNames(provider, workspace)).not.toContain('remove-me')
  })

  it('超过 8 MiB 的文件走多分片', async () => {
    const file = `${workspace}/multi-part.bin`
    const content = Buffer.alloc(9 * 1024 * 1024, 7)

    await writeFile(file, content, false)

    expect((await provider.stat(file)).size).toBe(content.byteLength)
    const downloaded = await readRemoteFile(provider, file)
    expect(downloaded.byteLength).toBe(content.byteLength)
    expect(downloaded.equals(content)).toBe(true)
  }, 60_000)

  it('超过 1000 个 key 时分页不漏条目', async () => {
    const directory = `${workspace}/many`
    const total = 1005

    // mkdir 只写一个零字节标记，比完整上传便宜，但仍走真实的 ListObjectsV2 分页。
    for (let start = 0; start < total; start += 60) {
      const batch = Array.from({ length: Math.min(60, total - start) }, (_, index) =>
        provider.mkdir(`${directory}/item-${start + index}`, { recursive: true }),
      )
      await Promise.all(batch)
    }

    const names = await listNames(provider, directory)
    expect(names).toHaveLength(total)
    expect(names).toContain('item-0')
    expect(names).toContain(`item-${total - 1}`)
  }, 120_000)
})
