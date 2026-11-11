import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Credentials } from '@shared/domain/credentials.js'
import type { ConnectionConfig } from '@shared/types/connection.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import type { FileProvider } from '../types.js'
import { createProvider } from '../registry.js'
import { createV9uSmbClient } from '../smb/client.js'
import {
  assertIntegrationEnabled,
  env,
  envNumber,
  listNames,
  readRemoteFile,
  removeQuietly,
  workspacePath,
  writeRemoteFile,
} from './support.js'

assertIntegrationEnabled()

const host = env('RIVET_SMB_HOST', '127.0.0.1')
const port = envNumber('RIVET_SMB_PORT', 1445)
const username = env('RIVET_SMB_USER', 'testuser')
const password = env('RIVET_SMB_PASSWORD', 'testpass')
const share = env('RIVET_SMB_SHARE', 'rivet')

const config: ConnectionConfig = {
  id: 'integration-smb',
  name: 'SMB integration',
  protocol: 'smb',
  host,
  port,
  username,
  authKind: 'password',
  share,
}

const workspace = workspacePath('smb-integration')

let provider: FileProvider
/** 会话创建次数：这是「每次操作重新握手」有没有真的消掉的唯一证据。 */
let createdSessions = 0

describe('SMB provider 对真实服务', () => {
  beforeAll(async () => {
    provider = createProvider('smb', {
      config,
      createSmbClient: (smbConfig: ConnectionConfig, credentials: Credentials) => {
        createdSessions += 1
        return createV9uSmbClient(smbConfig, credentials)
      },
    })
    await provider.connect({ kind: 'password', username, password })
    await provider.mkdir(workspace, { recursive: true })
  })

  afterAll(async () => {
    await removeQuietly(provider, workspace)
    await provider.disconnect()
  })

  it('ping 并列出根目录', async () => {
    await provider.ping()

    expect(await listNames(provider, '/')).toContain(workspace.slice(1))
    expect(await provider.stat(workspace)).toMatchObject({
      name: workspace.slice(1),
      kind: 'directory',
    })
  })

  it('重复列目录不再每次操作新开会话', async () => {
    const before = createdSessions

    for (let index = 0; index < 40; index += 1) {
      await listNames(provider, workspace)
    }

    expect(createdSessions - before).toBeLessThanOrEqual(1)
  })

  it('顺序上传不会随文件数增加会话', async () => {
    const before = createdSessions

    for (let index = 0; index < 20; index += 1) {
      await writeRemoteFile(
        provider,
        `${workspace}/f${index}.txt`,
        Buffer.from(`payload-${index}`),
        false,
      )
    }

    expect(createdSessions - before).toBeLessThanOrEqual(1)

    const names = await listNames(provider, workspace)
    expect(names.filter((name) => name.startsWith('f'))).toHaveLength(20)
    expect(names.filter((name) => name.endsWith('.rivet-tmp'))).toEqual([])
  })

  it('读写往返保留内容与偏移', async () => {
    const content = Buffer.from('hello smb 世界', 'utf8')
    const file = `${workspace}/round-trip.txt`
    await writeRemoteFile(provider, file, content, false)

    expect((await readRemoteFile(provider, file)).equals(content)).toBe(true)
    expect((await readRemoteFile(provider, file, 6)).equals(content.subarray(6))).toBe(true)
  })

  it('删除目录后条目立即消失', async () => {
    const tree = `${workspace}/tree`
    await provider.mkdir(`${tree}/sub`, { recursive: true })
    await writeRemoteFile(provider, `${tree}/sub/a.txt`, Buffer.from('a'), false)

    await provider.remove(tree)

    await expect(provider.stat(tree)).rejects.toMatchObject({ code: ERROR_CODE.NOT_FOUND })
  })

  it('操作失败后丢弃会话，下一次操作重新建连', async () => {
    const before = createdSessions

    await expect(provider.stat(`${workspace}/missing.txt`)).rejects.toMatchObject({
      code: ERROR_CODE.NOT_FOUND,
    })
    expect(createdSessions - before).toBe(1)

    await provider.stat(workspace)
    expect(createdSessions - before).toBe(2)
  })
})
