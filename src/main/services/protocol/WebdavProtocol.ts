import { createClient, type WebDAVClient, type FileStat } from 'webdav'
import http from 'node:http'
import https from 'node:https'
import { type ConnectionConfig, type FileInfo, type OperationResult } from '@shared/types/index.js'
import { PROTOCOL_WEBDAV, ProtocolStatus } from '@shared/constants/index.js'
import { generateSessionId, logger } from '@main/utils/index.js'
import { TIMEOUTS, HTTP_AGENT } from '@shared/constants/timeouts.js'
import { AbstractProtocol, type SessionInfo } from './abstract-protocol.js'
import { sessionManager } from '../session-manager.js'
import { type Result, ok, err, type ErrorInfo, createErrorInfo } from '@shared/types/result.js'
import { joinPaths, formatErrorMessage } from '@shared/utils/index.js'

interface WebDAVSession {
  client: WebDAVClient
  controller: AbortController
  agent: http.Agent | https.Agent
}

export class WebdavProtocol extends AbstractProtocol<WebDAVSession> {
  readonly protocolType = 'webdav' as const

  protected getSessionInfo(sessionId: string): SessionInfo | null {
    const handle = sessionManager.get<WebDAVSession>(sessionId)
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

  async connect(
    config: ConnectionConfig,
    password: string
  ): Promise<Result<OperationResult, ErrorInfo>> {
    const sessionId = generateSessionId(PROTOCOL_WEBDAV)
    const useScheme = config.scheme ?? 'https'
    const url = `${useScheme}://${config.host}:${config.port}`

    const agent =
      useScheme === 'http'
        ? new http.Agent({
            keepAlive: true,
            maxSockets: HTTP_AGENT.MAX_SOCKETS,
            maxFreeSockets: HTTP_AGENT.MAX_FREE_SOCKETS,
            timeout: TIMEOUTS.AGENT,
          })
        : new https.Agent({
            keepAlive: true,
            maxSockets: HTTP_AGENT.MAX_SOCKETS,
            maxFreeSockets: HTTP_AGENT.MAX_FREE_SOCKETS,
            timeout: TIMEOUTS.AGENT,
            rejectUnauthorized: config.rejectUnauthorized ?? true,
          })

    const controller = new AbortController()

    const client = createClient(url, {
      username: config.username,
      password: password ?? '',
      httpAgent: useScheme === 'http' ? agent : undefined,
      httpsAgent: useScheme === 'https' ? agent : undefined,
    })

    try {
      const testPath = config.basePath ?? '/'
      await client.getDirectoryContents(testPath, { signal: controller.signal })
    } catch (e) {
      const error = e as Error
      agent.destroy()
      logger.catch(error, { action: 'connect' })
      return err(createErrorInfo('CONN_FAILED', formatErrorMessage(error)))
    }

    const session: WebDAVSession = { client, controller, agent }
    sessionManager.register(sessionId, session, config, PROTOCOL_WEBDAV)

    return ok({
      sessionId,
      statusCode: ProtocolStatus.OK,
      detail: {
        hash: '',
      },
    })
  }

  async disconnect(sessionId: string): Promise<Result<void, ErrorInfo>> {
    try {
      const clientResult = this.getClient(sessionId)
      if (clientResult.error) {
        return clientResult
      }

      const session = clientResult.value
      session.controller.abort()
      session.agent.destroy()
      await Promise.resolve()
    } catch (e) {
      logger.catch(e, { action: 'disconnect' })
    } finally {
      sessionManager.unregister(sessionId)
    }

    return ok(undefined)
  }

  protected async listImpl(
    session: WebDAVSession,
    path: string,
    basePath: string
  ): Promise<Result<FileInfo[], ErrorInfo>> {
    try {
      const serverPath = path === '/' ? basePath : joinPaths(basePath, path)
      const response = await session.client.getDirectoryContents(serverPath)

      const result = response.map((item: FileStat): FileInfo => {
        const itemName = item.filename.split('/').pop() ?? ''
        const absolutePath = path === '/' ? `/${itemName}` : joinPaths(path, itemName)
        const fileType = item.type === 'directory' ? 'directory' : 'file'
        return {
          name: itemName,
          type: fileType,
          size: item.size || 0,
          modifyTime: item.lastmod ? new Date(item.lastmod).getTime() : 0,
          permissions: '',
          owner: '',
          absolutePath,
        }
      })

      return ok(result)
    } catch (e) {
      return err(createErrorInfo('LIST_ERROR', formatErrorMessage(e)))
    }
  }

  protected async mkdirImpl(
    session: WebDAVSession,
    path: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverPath = joinPaths(basePath, path)
      await session.client.createDirectory(serverPath, { recursive: true })
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('MKDIR_ERROR', formatErrorMessage(e)))
    }
  }

  protected async renameImpl(
    session: WebDAVSession,
    oldPath: string,
    newPath: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverOldPath = joinPaths(basePath, oldPath)
      const serverNewPath = joinPaths(basePath, newPath)
      await session.client.moveFile(serverOldPath, serverNewPath)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('RENAME_ERROR', formatErrorMessage(e)))
    }
  }

  protected async deleteImpl(
    session: WebDAVSession,
    path: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverPath = joinPaths(basePath, path)
      await session.client.deleteFile(serverPath)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('DELETE_ERROR', formatErrorMessage(e)))
    }
  }

  protected async copyImpl(
    session: WebDAVSession,
    sourcePath: string,
    targetPath: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverSourcePath = joinPaths(basePath, sourcePath)
      const serverTargetPath = joinPaths(basePath, targetPath)
      await session.client.copyFile(serverSourcePath, serverTargetPath, { overwrite: true })
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('COPY_ERROR', formatErrorMessage(e)))
    }
  }

  protected async moveImpl(
    session: WebDAVSession,
    sourcePath: string,
    targetPath: string,
    basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverSourcePath = joinPaths(basePath, sourcePath)
      const serverTargetPath = joinPaths(basePath, targetPath)
      await session.client.moveFile(serverSourcePath, serverTargetPath)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('MOVE_ERROR', formatErrorMessage(e)))
    }
  }

  protected async pingImpl(
    session: WebDAVSession,
    basePath: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      await session.client.stat(basePath)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo('PING_ERROR', formatErrorMessage(e)))
    }
  }
}

export default WebdavProtocol
