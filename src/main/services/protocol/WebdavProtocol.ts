import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import { createClient, type FileStat, type WebDAVClient } from 'webdav'
import { generateSessionId, logger } from '@main/utils/index.js'
import {
  ERROR_CODE,
  FILE_TYPE,
  HTTP_AGENT,
  PROTOCOL,
  ProtocolStatus,
  ROOT_PATH,
  SCHEME,
  TIMEOUTS,
} from '@shared/constants/index.js'
import {
  type ConnectionConfig,
  createErrorInfo,
  err,
  type ErrorInfo,
  type FileInfo,
  ok,
  type OperationResult,
  type Result,
} from '@shared/types/index.js'
import { formatErrorMessage, joinPaths } from '@shared/utils/index.js'
import { sessionRegistry } from '../session-registry.js'
import { AbstractProtocol, type HostVerifier, type SessionInfo } from './abstract-protocol.js'

interface WebDAVSession {
  client: WebDAVClient
  controller: AbortController
  agent: http.Agent | https.Agent
}

export class WebdavProtocol extends AbstractProtocol<WebDAVSession> {
  readonly protocolType = PROTOCOL.WEBDAV

  protected getSessionInfo(sessionId: string): SessionInfo | null {
    const handle = sessionRegistry.get<WebDAVSession>(sessionId)
    if (!handle) return null
    return {
      client: handle.client,
      basePath: handle.config.basePath ?? '',
      isClosing: handle.isClosing ?? false,
    }
  }

  protected setSessionClosing(sessionId: string): void {
    sessionRegistry.setClosing(sessionId)
  }

  async connect(
    config: ConnectionConfig,
    password: string,
    _hostVerifier?: HostVerifier
  ): Promise<Result<OperationResult, ErrorInfo>> {
    const sessionId = generateSessionId(PROTOCOL.WEBDAV)
    const useScheme = config.scheme ?? SCHEME.HTTPS
    const url = `${useScheme}://${config.host}:${config.port}`

    const agent =
      useScheme === SCHEME.HTTP
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
      httpAgent: useScheme === SCHEME.HTTP ? agent : undefined,
      httpsAgent: useScheme === SCHEME.HTTPS ? agent : undefined,
    })

    try {
      const testPath = config.basePath ?? ROOT_PATH
      await client.getDirectoryContents(testPath, { signal: controller.signal })
    } catch (e) {
      const error = e as Error
      agent.destroy()
      logger.catch(error, { action: 'connect' })
      return err(createErrorInfo(ERROR_CODE.CONN_FAILED, formatErrorMessage(error)))
    }

    const session: WebDAVSession = { client, controller, agent }
    sessionRegistry.register(sessionId, session, config, PROTOCOL.WEBDAV)

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
      sessionRegistry.unregister(sessionId)
    }

    return ok(undefined)
  }

  protected async listImpl(
    session: WebDAVSession,
    path: string,
    basePath: string
  ): Promise<Result<FileInfo[], ErrorInfo>> {
    try {
      const serverPath = path === ROOT_PATH ? basePath : joinPaths(basePath, path)
      const response = await session.client.getDirectoryContents(serverPath)

      const result = response.map((item: FileStat): FileInfo => {
        const itemName = item.filename.split('/').pop() ?? ''
        const absolutePath = path === ROOT_PATH ? `/${itemName}` : joinPaths(path, itemName)
        const fileType = item.type === 'directory' ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE
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
      return err(createErrorInfo(ERROR_CODE.LIST_ERROR, formatErrorMessage(e)))
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
      return err(createErrorInfo(ERROR_CODE.MKDIR_ERROR, formatErrorMessage(e)))
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
      return err(createErrorInfo(ERROR_CODE.RENAME_ERROR, formatErrorMessage(e)))
    }
  }

  protected async deleteImpl(
    session: WebDAVSession,
    path: string,
    basePath: string,
    _fileType: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverPath = joinPaths(basePath, path)
      await session.client.deleteFile(serverPath)
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo(ERROR_CODE.DELETE_ERROR, formatErrorMessage(e)))
    }
  }

  protected async copyImpl(
    session: WebDAVSession,
    sourcePath: string,
    targetPath: string,
    basePath: string,
    _fileType: string
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverSourcePath = joinPaths(basePath, sourcePath)
      const serverTargetPath = joinPaths(basePath, targetPath)
      await session.client.copyFile(serverSourcePath, serverTargetPath, { overwrite: true })
      return ok(undefined)
    } catch (e) {
      return err(createErrorInfo(ERROR_CODE.COPY_ERROR, formatErrorMessage(e)))
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
      return err(createErrorInfo(ERROR_CODE.MOVE_ERROR, formatErrorMessage(e)))
    }
  }

  protected async uploadImpl(
    session: WebDAVSession,
    localPath: string,
    remotePath: string,
    basePath: string,
    onProgress: (transferred: number) => void,
    signal: AbortSignal
  ): Promise<Result<void, ErrorInfo>> {
    try {
      const serverPath = joinPaths(basePath, remotePath)
      const stat = await fs.promises.stat(localPath)
      const contentLength = stat.size
      let transferred = 0

      const stream = fs.createReadStream(localPath)
      stream.on('data', (chunk: Buffer) => {
        if (!signal.aborted) {
          transferred += chunk.length
          onProgress(transferred)
        }
      })

      await session.client.putFileContents(serverPath, stream, {
        contentLength,
        overwrite: true,
        signal,
      })

      return ok(undefined)
    } catch (e) {
      if (signal.aborted) {
        return err(createErrorInfo(ERROR_CODE.UPLOAD_ABORTED, 'Upload was aborted'))
      }
      return err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, formatErrorMessage(e)))
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
      return err(createErrorInfo(ERROR_CODE.PING_ERROR, formatErrorMessage(e)))
    }
  }
}

export default WebdavProtocol
