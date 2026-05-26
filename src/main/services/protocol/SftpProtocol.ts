import Client from 'ssh2-sftp-client'
import {
  type ConnectionConfig,
  type FileInfo,
  type SftpConnectDetail,
  type OperationResult,
} from '@shared/types/index.js'
import { generateSessionId, logger } from '@main/utils/index.js'
import {
  type StatusCode,
  ProtocolStatus,
  SftpStatus,
  PROTOCOL_SFTP,
} from '@shared/constants/index.js'
import { TIMEOUTS } from '@shared/constants/timeouts.js'
import { AbstractProtocol, type SessionInfo } from './abstract-protocol.js'
import { sessionManager } from '../session-manager.js'
import { getHostKeyRecord } from '../../stores/index.js'
import { type Result, ok, err, type ErrorInfo, createErrorInfo } from '@shared/types/result.js'
import { joinPaths, formatErrorMessage } from '@shared/utils/index.js'

export class SftpProtocol extends AbstractProtocol<Client> {
  readonly protocolType = 'sftp' as const

  protected getSessionInfo(sessionId: string): SessionInfo | null {
    const handle = sessionManager.get<Client>(sessionId)
    if (!handle) return null
    return {
      client: handle.client,
      basePath: handle.config.basePath ?? '',
      isClosing: handle._closing ?? false,
    }
  }

  protected setSessionClosing(sessionId: string): void {
    sessionManager.setClosing(sessionId)
  }

  private createHostVerifier(config: ConnectionConfig): {
    verifier: (hashedKey: string) => boolean
    getResult: () => { detail: SftpConnectDetail | null; status: StatusCode | null }
  } {
    let capturedDetail: SftpConnectDetail | null = null
    let capturedStatus: StatusCode | null = null

    const verifier = (hashedKey: string): boolean => {
      const hostKeyResult = getHostKeyRecord(config.id)
      const hostKey = hostKeyResult.success ? hostKeyResult.value : undefined

      if (!hostKey) {
        capturedDetail = { hash: hashedKey }
        capturedStatus = ProtocolStatus.FIRST_CONNECT
        return true
      }

      if (hostKey.hash === hashedKey) {
        capturedDetail = { hash: hashedKey }
        capturedStatus = ProtocolStatus.OK
        return true
      }

      capturedDetail = {
        hash: hashedKey,
        previousHash: hostKey.hash,
      }
      capturedStatus = SftpStatus.HOST_KEY_MISMATCH
      return false
    }

    return {
      verifier,
      getResult: () => ({ detail: capturedDetail, status: capturedStatus }),
    }
  }

  async connect(
    config: ConnectionConfig,
    password: string
  ): Promise<Result<OperationResult, ErrorInfo>> {
    const client = new Client()
    const sessionId = generateSessionId(PROTOCOL_SFTP)
    const { verifier, getResult } = this.createHostVerifier(config)

    try {
      await client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: password ?? '',
        readyTimeout: TIMEOUTS.SFTP_READY,
        hostHash: 'sha256',
        hostVerifier: verifier,
      })

      const { detail, status } = getResult()
      const connectDetail: SftpConnectDetail = detail ?? { hash: '' }
      sessionManager.register(sessionId, client, config, PROTOCOL_SFTP)

      return ok({
        sessionId,
        statusCode: status ?? ProtocolStatus.OK,
        detail: connectDetail,
      })
    } catch (e) {
      const { detail, status } = getResult()

      if (status === SftpStatus.HOST_KEY_MISMATCH && detail) {
        return ok({
          sessionId: '',
          statusCode: status,
          detail,
        })
      }

      try {
        await client.end()
      } catch (closeError) {
        logger.catch(closeError, { action: 'close-connection' })
      }

      logger.catch(e, { configId: config.id })
      return err(createErrorInfo('CONN_FAILED', formatErrorMessage(e)))
    }
  }

  async disconnect(sessionId: string): Promise<Result<void, ErrorInfo>> {
    try {
      const clientResult = this.getClient(sessionId)
      if (clientResult.error) {
        return clientResult
      }

      await clientResult.value.end()
    } catch (e) {
      logger.catch(e, { sessionId, action: 'disconnect' })
    } finally {
      sessionManager.unregister(sessionId)
    }

    return ok(undefined)
  }

  protected async listImpl(
    client: Client,
    path: string,
    _basePath: string
  ): Promise<Result<FileInfo[], ErrorInfo>> {
    try {
      const list = (await client.list(path)) as unknown as Array<{
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

      const result = list.map(item => {
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
        const absolutePath = joinPaths(path, itemName)
        const fileType: 'directory' | 'file' = item.type === 'd' ? 'directory' : 'file'
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

      return ok(result)
    } catch (e) {
      return err(createErrorInfo('LIST_ERROR', formatErrorMessage(e)))
    }
  }

  protected async mkdirImpl(
    client: Client,
    path: string,
    _basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      await client.mkdir(path, true)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('MKDIR_ERROR', formatErrorMessage(e)))
    }
  }

  protected async renameImpl(
    client: Client,
    oldPath: string,
    newPath: string,
    _basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      await client.rename(oldPath, newPath)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('RENAME_ERROR', formatErrorMessage(e)))
    }
  }

  protected async deleteImpl(
    client: Client,
    path: string,
    _basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const stat = await client.stat(path)
      if (stat.isDirectory) {
        await client.rmdir(path, true)
      } else {
        await client.delete(path)
      }
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('DELETE_ERROR', formatErrorMessage(e)))
    }
  }

  protected async copyImpl(
    client: Client,
    sourcePath: string,
    targetPath: string,
    _basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const stat = await client.stat(sourcePath)
      if (stat.isDirectory) {
        await this.copyDirectory(client, sourcePath, targetPath)
      } else {
        await client.rcopy(sourcePath, targetPath)
      }
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('COPY_ERROR', formatErrorMessage(e)))
    }
  }

  private async copyDirectory(
    client: Client,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    await client.mkdir(targetPath, true)
    const list = await client.list(sourcePath)

    for (const item of list) {
      const sourceItemPath = joinPaths(sourcePath, item.name)
      const targetItemPath = joinPaths(targetPath, item.name)

      if (item.type === 'd') {
        await client.mkdir(targetItemPath, true)
        await this.copyDirectory(client, sourceItemPath, targetItemPath)
      } else {
        await client.rcopy(sourceItemPath, targetItemPath)
      }
    }
  }

  protected async moveImpl(
    client: Client,
    sourcePath: string,
    targetPath: string,
    _basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      try {
        const stat = await client.stat(targetPath)
        if (stat) {
          await client.delete(targetPath)
        }
      } catch (e) {
        logger.catch(e, { action: 'check-target-before-move' })
      }
      await client.rename(sourcePath, targetPath)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('MOVE_ERROR', formatErrorMessage(e)))
    }
  }

  protected async pingImpl(client: Client, _basePath: string): Promise<Result<void, ErrorInfo>> {
    try {
      await client.stat('/')
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('PING_ERROR', formatErrorMessage(e)))
    }
  }
}

export default SftpProtocol
