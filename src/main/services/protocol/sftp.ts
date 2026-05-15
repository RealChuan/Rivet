import Client from 'ssh2-sftp-client'
import {
  type ConnectionConfig,
  type FileInfo,
  type SftpConnectDetail,
} from '@shared/types/index.js'
import { generateSessionId } from '@main/utils/index.js'
import {
  type StatusCode,
  ProtocolStatus,
  SftpStatus,
  Protocol_SFTP,
} from '@shared/constants/index.js'
import { TIMEOUTS } from '@shared/constants/timeouts.js'
import { BaseProtocolImpl, type FileProtocol } from './base.js'
import { sessionManager } from '../session-manager.js'
import { getKnownHost } from '../../stores/index.js'

export class SftpProtocol extends BaseProtocolImpl<Client> implements FileProtocol {
  readonly protocolType = 'sftp' as const

  private createHostVerifier(config: ConnectionConfig): {
    verifier: (hashedKey: string) => boolean
    getResult: () => { detail: SftpConnectDetail | null; status: StatusCode | null }
  } {
    let capturedDetail: SftpConnectDetail | null = null
    let capturedStatus: StatusCode | null = null

    const verifier = (hashedKey: string): boolean => {
      const hostKey = getKnownHost(config.connectionUuid)

      if (!hostKey) {
        capturedDetail = { fingerprint: hashedKey }
        capturedStatus = ProtocolStatus.FIRST_CONNECT
        return true
      }

      if (hostKey.fingerprint === hashedKey) {
        capturedDetail = { fingerprint: hashedKey }
        capturedStatus = ProtocolStatus.OK
        return true
      }

      capturedDetail = {
        fingerprint: hashedKey,
        previousFingerprint: hostKey.fingerprint,
      }
      capturedStatus = SftpStatus.HOST_KEY_MISMATCH
      return false
    }

    return {
      verifier,
      getResult: () => ({ detail: capturedDetail, status: capturedStatus }),
    }
  }

  async connect(config: ConnectionConfig) {
    const client = new Client()
    const sessionId = generateSessionId(Protocol_SFTP)
    const { verifier, getResult } = this.createHostVerifier(config)

    try {
      await client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password ?? '',
        readyTimeout: TIMEOUTS.SFTP_READY,
        hostHash: 'sha256',
        hostVerifier: verifier,
      })

      const { detail, status } = getResult()
      sessionManager.register(sessionId, client, config, Protocol_SFTP)
      this.logOperation('connected', `${config.host}:${config.port}`, sessionId)

      return {
        sessionId,
        statusCode: status!,
        detail: detail!,
      }
    } catch (error) {
      const { detail, status } = getResult()

      if (status === SftpStatus.HOST_KEY_MISMATCH && detail) {
        return {
          sessionId: '',
          statusCode: status,
          detail,
        }
      }

      this.logOperation('connection failed', '', '', error)

      try {
        await client.end()
      } catch (cleanupError) {
        this.logOperation('cleanup failed', '', '', cleanupError)
      }

      throw error
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    try {
      const client = this.getClient(sessionId)
      await client.end()
    } catch {
      // 连接可能已断开，忽略错误
    } finally {
      sessionManager.unregister(sessionId)
      this.logOperation('disconnected', sessionId, '')
    }
  }

  async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const client = this.getClient(sessionId)

    try {
      const list = (await client.list(remotePath)) as unknown as Array<{
        name: string
        type: string
        size: number
        modifyTime: string | Date
        rights?: {
          user?: string
          group?: string
          other?: string
        }
        longname?: string
      }>

      return list.map(item => {
        const rights = item.rights ?? {}
        const padPermission = (perm?: string) => {
          if (!perm) return '---'
          const p = perm.padEnd(3, '-')
          return p.substring(0, 3)
        }
        const permissions = `${padPermission(rights.user)}${padPermission(rights.group)}${padPermission(rights.other)}`

        let owner = ''
        if (item.longname) {
          const parts = item.longname.split(/\s+/)
          if (parts.length >= 4) {
            owner = parts[2] ?? ''
          }
        }

        const itemName = typeof item.name === 'string' ? item.name : ''
        const absolutePath = this.joinPaths(remotePath, itemName)
        const fileType = item.type === 'd' ? 'directory' : 'file'
        return {
          name: itemName,
          type: fileType,
          size: typeof item.size === 'number' ? item.size : 0,
          modifyTime: item.modifyTime ? new Date(item.modifyTime).getTime() : 0,
          permissions: permissions !== '-----------' ? permissions : '',
          owner,
          absolutePath,
        }
      })
    } catch (error) {
      this.logOperation('list failed', remotePath, '', error)
      throw error
    }
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    const client = this.getClient(sessionId)

    try {
      await client.mkdir(path, true)
      this.logOperation('mkdir', path, '')
    } catch (error) {
      this.logOperation('mkdir failed', path, '', error)
      throw error
    }
  }

  async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const client = this.getClient(sessionId)

    try {
      const newPath = this.joinPaths(this.getParentPath(file.absolutePath), newName)
      await client.rename(file.absolutePath, newPath)
      this.logOperation('rename', file.name, newName)
    } catch (error) {
      this.logOperation('rename failed', file.name, newName, error)
      throw error
    }
  }

  async delete(sessionId: string, file: FileInfo): Promise<void> {
    const client = this.getClient(sessionId)

    try {
      if (file.type === 'directory') {
        await client.rmdir(file.absolutePath, true)
      } else {
        await client.delete(file.absolutePath)
      }
      this.logOperation('delete', file.absolutePath, '')
    } catch (error) {
      this.logOperation('delete failed', file.absolutePath, '', error)
      throw error
    }
  }

  async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const client = this.getClient(sessionId)
    const sourcePath = file.absolutePath

    try {
      if (file.type === 'directory') {
        await this.copyDirectory(client, sourcePath, targetPath)
      } else {
        await client.rcopy(sourcePath, targetPath)
      }
      this.logOperation('copy completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('copy failed', sourcePath, targetPath, error)
      throw error
    }
  }

  async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const client = this.getClient(sessionId)
    const sourcePath = file.absolutePath

    try {
      try {
        await client.stat(targetPath)
        await client.delete(targetPath)
      } catch {
        // target does not exist, ignore
      }
      await client.rename(sourcePath, targetPath)
      this.logOperation('move completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('move failed', sourcePath, targetPath, error)
      throw error
    }
  }

  private async copyDirectory(
    client: Client,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    await client.mkdir(targetPath, true)

    const queue: Array<{ src: string; dest: string }> = [{ src: sourcePath, dest: targetPath }]

    while (queue.length > 0) {
      const { src, dest } = queue.shift()!
      const list = await client.list(src)

      for (const item of list) {
        const sourceItemPath = this.joinPaths(src, item.name)
        const targetItemPath = this.joinPaths(dest, item.name)

        if (item.type === 'd') {
          await client.mkdir(targetItemPath, true)
          queue.push({ src: sourceItemPath, dest: targetItemPath })
        } else {
          await client.rcopy(sourceItemPath, targetItemPath)
        }
      }
    }
  }

  async ping(sessionId: string): Promise<void> {
    const client = this.getClient(sessionId)
    await client.stat('/')
  }
}

export default SftpProtocol
