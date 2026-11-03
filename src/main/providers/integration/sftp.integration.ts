import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { FileProvider } from '../types.js'
import { ProviderError } from '../errors.js'
import { createProvider } from '../registry.js'
import { parseHostPublicKey, type ParsedHostKey } from '../sftp/host-key.js'
import {
  assertIntegrationEnabled,
  env,
  envNumber,
  listNames,
  optionalEnv,
  readRemoteFile,
  removeQuietly,
  workspacePath,
  writeRemoteFile,
} from './support.js'

assertIntegrationEnabled()

const host = env('RIVET_SFTP_HOST', '127.0.0.1')
const port = envNumber('RIVET_SFTP_PORT', 2222)
const username = env('RIVET_SFTP_USER', 'testuser')
const password = env('RIVET_SFTP_PASSWORD', 'testpass')
const privateKeyPath = optionalEnv('RIVET_SFTP_PRIVATE_KEY') ?? ''
const privateKeyPassphrase = optionalEnv('RIVET_SFTP_PRIVATE_KEY_PASSPHRASE')
const workspaceRoot = optionalEnv('RIVET_SFTP_ROOT')

const config: ConnectionConfig = {
  id: 'integration-sftp',
  name: 'SFTP integration',
  protocol: 'sftp',
  host,
  port,
  username,
  authKind: 'password',
}

let workspace = ''
let workspaceParent = '/'

let provider: FileProvider
let connected = false
let hostKey: ParsedHostKey | null = null

async function prepareWorkspace(): Promise<void> {
  const candidate = workspacePath('sftp-integration')

  if (workspaceRoot !== undefined) {
    const base = workspaceRoot === '/' ? '' : workspaceRoot.replace(/\/+$/, '')
    workspace = `${base}${candidate}`
    workspaceParent = base === '' ? '/' : base
    await provider.mkdir(workspace, { recursive: true })
    return
  }

  try {
    await provider.mkdir(candidate, { recursive: true })
    workspace = candidate
    return
  } catch (error) {
    if (!(error instanceof ProviderError && error.code === ERROR_CODE.PERMISSION_DENIED)) {
      throw error
    }
    // atmoz/sftp 把用户 chroot 到家目录，根目录不可写，只有 upload/ 可写。
    await provider.mkdir('/upload', { recursive: true })
    workspace = `/upload${candidate}`
    workspaceParent = '/upload'
    await provider.mkdir(workspace, { recursive: true })
  }
}

describe('SFTP provider 对真实服务', () => {
  beforeAll(async () => {
    provider = createProvider('sftp', {
      config,
      hostVerifier: (publicKey) => {
        hostKey = parseHostPublicKey(publicKey)
        return true
      },
    })
    await provider.connect({ kind: 'password', username, password })
    connected = true
    await prepareWorkspace()
  })

  afterAll(async () => {
    if (!connected || workspace === '') return
    await removeQuietly(provider, workspace)
    await provider.disconnect()
  })

  it('连接时能解析真实服务器的主机密钥', () => {
    expect(hostKey?.algorithm).toMatch(/^ssh-/)
    expect(hostKey?.fingerprint).toMatch(/^SHA256:/)
  })

  it('列出工作目录所在目录并 stat 工作目录', async () => {
    const names = await listNames(provider, workspaceParent)
    const name =
      workspaceParent === '/' ? workspace.slice(1) : workspace.slice(workspaceParent.length + 1)
    expect(names).toContain(name)

    const stat = await provider.stat(workspace)
    expect(stat).toMatchObject({ name, kind: 'directory' })
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

  it('支持从指定偏移读取', async () => {
    const file = `${workspace}/range.txt`
    await writeRemoteFile(provider, file, Buffer.from('0123456789'), false)

    const suffix = await readRemoteFile(provider, file, 4)
    expect(suffix.toString('utf8')).toBe('456789')
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

  it.skipIf(privateKeyPath === '')(
    '支持私钥认证与口令（需设置 RIVET_SFTP_PRIVATE_KEY）',
    async () => {
      const credentials: Credentials = {
        kind: 'privateKey',
        username,
        privateKeyPath,
        ...(privateKeyPassphrase !== undefined ? { passphrase: privateKeyPassphrase } : {}),
      }
      const keyProvider = createProvider('sftp', { config })

      try {
        await keyProvider.connect(credentials)
        await keyProvider.ping()
      } finally {
        await keyProvider.disconnect()
      }
    },
  )
})
