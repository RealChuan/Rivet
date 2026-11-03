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
  writeRemoteFile,
} from './support.js'

assertIntegrationEnabled()

const url = new URL(env('RIVET_WEBDAV_URL', 'http://127.0.0.1:8080'))
const scheme: 'http' | 'https' = url.protocol === 'https:' ? 'https' : 'http'
const port = url.port === '' ? (scheme === 'https' ? 443 : 80) : Number(url.port)
const basePath = url.pathname === '/' ? '' : url.pathname.replace(/\/+$/, '')
const username = env('RIVET_WEBDAV_USER', 'testuser')
const password = env('RIVET_WEBDAV_PASSWORD', 'testpass')

const config: ConnectionConfig = {
  id: 'integration-webdav',
  name: 'WebDAV integration',
  protocol: 'webdav',
  host: url.hostname,
  port,
  username,
  authKind: 'password',
  scheme,
  rejectUnauthorized: envBoolean('RIVET_WEBDAV_REJECT_UNAUTHORIZED', true),
  ...(basePath === '' ? {} : { basePath }),
}

const workspace = workspacePath('webdav-integration')

let provider: FileProvider
let connected = false

describe('WebDAV provider 对真实服务', () => {
  beforeAll(async () => {
    provider = createProvider('webdav', { config })
    await provider.connect({ kind: 'password', username, password })
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

  it('递归创建目录并处理中文、空格、百分号与井号', async () => {
    const directory = `${workspace}/文档 资料/2024 年`
    await provider.mkdir(directory, { recursive: true })

    const file = `${directory}/100% 完成 #1.txt`
    const content = Buffer.from('hello 世界\n', 'utf8')
    await writeRemoteFile(provider, file, content, false)

    const stat = await provider.stat(file)
    expect(stat.name).toBe('100% 完成 #1.txt')
    expect(stat.size).toBe(content.byteLength)

    const names = await listNames(provider, directory)
    expect(names).toContain('100% 完成 #1.txt')

    const downloaded = await readRemoteFile(provider, file)
    expect(downloaded.equals(content)).toBe(true)
  })

  it('覆盖写替换内容且不留下临时文件', async () => {
    const file = `${workspace}/overwrite.txt`
    await writeRemoteFile(provider, file, Buffer.from('first'), false)
    await writeRemoteFile(provider, file, Buffer.from('second'), true)

    expect((await readRemoteFile(provider, file)).toString('utf8')).toBe('second')

    const leftovers = (await listNames(provider, workspace)).filter((name) =>
      name.endsWith('.rivet-tmp'),
    )
    expect(leftovers).toEqual([])
  })

  it('目标存在且 overwrite:false 时返回 ALREADY_EXISTS', async () => {
    const file = `${workspace}/exists.txt`
    await writeRemoteFile(provider, file, Buffer.from('x'), false)

    await expect(provider.openWrite(file, { overwrite: false })).rejects.toMatchObject({
      code: ERROR_CODE.ALREADY_EXISTS,
    })
  })

  it('rename 覆盖已存在的目标', async () => {
    const from = `${workspace}/from.txt`
    const to = `${workspace}/to.txt`
    await writeRemoteFile(provider, from, Buffer.from('from'), false)
    await writeRemoteFile(provider, to, Buffer.from('to'), false)

    await provider.rename(from, to)

    expect((await readRemoteFile(provider, to)).toString('utf8')).toBe('from')
    await expect(provider.stat(from)).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND })
  })

  it('服务端 COPY 复制文件', async () => {
    const from = `${workspace}/copy-from.txt`
    const to = `${workspace}/copy-to.txt`
    await writeRemoteFile(provider, from, Buffer.from('copy'), false)

    if (provider.copy === undefined) throw new Error('WebDAV provider 应支持 COPY')
    await provider.copy(from, to)

    expect((await readRemoteFile(provider, to)).toString('utf8')).toBe('copy')
    expect((await readRemoteFile(provider, from)).toString('utf8')).toBe('copy')
  })

  it('递归删除非空目录并把缺失路径映射为 NOT_FOUND', async () => {
    const tree = `${workspace}/tree`
    await provider.mkdir(`${tree}/sub`, { recursive: true })
    await writeRemoteFile(provider, `${tree}/sub/a.txt`, Buffer.from('a'), false)

    await provider.remove(tree)
    await expect(provider.stat(tree)).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND })
    await expect(provider.stat(`${workspace}/missing.txt`)).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    })
  })
})
