import { createClient, type WebDAVClient, type FileStat } from 'webdav'
import path from 'path'
import http from 'node:http'
import https from 'node:https'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { generateSessionId } from '@main/utils/index.js'
import { ProtocolStatus, ProtocolType, FileOperation } from '@shared/constants/index.js'
import { BaseProtocolImpl, type FileProtocol } from './base.js'
import { sessionManager } from './session-manager.js'

interface WebDAVSession {
  client: WebDAVClient
  controller: AbortController
  agent: http.Agent | https.Agent
}

export class WebdavProtocol extends BaseProtocolImpl<WebDAVSession> implements FileProtocol {
  readonly protocolType = 'webdav' as const

  async connect(config: ConnectionConfig) {
    const sessionId = generateSessionId(ProtocolType.WEBDAV)
    const useScheme = config.scheme ?? 'https'
    const url = `${useScheme}://${config.host}:${config.port}`

    const agent =
      useScheme === 'http'
        ? new http.Agent({
            keepAlive: true,
            maxSockets: 10,
            maxFreeSockets: 5,
            timeout: 30000,
          })
        : new https.Agent({
            keepAlive: true,
            maxSockets: 10,
            maxFreeSockets: 5,
            timeout: 30000,
            rejectUnauthorized: config.rejectUnauthorized ?? true,
          })

    const controller = new AbortController()

    const client = createClient(url, {
      username: config.username,
      password: config.password ?? '',
      httpAgent: useScheme === 'http' ? agent : undefined,
      httpsAgent: useScheme === 'https' ? agent : undefined,
    })

    try {
      const testPath = config.basePath ?? '/'
      await client.getDirectoryContents(testPath, { signal: controller.signal })
    } catch (error) {
      this.logOperation('connection failed', `${config.host}:${config.port}`, '', error)
      agent.destroy()
      throw error
    }

    const session: WebDAVSession = { client, controller, agent }
    sessionManager.register(sessionId, session, config, ProtocolType.WEBDAV)
    this.logOperation(
      'connected',
      `${config.host}:${config.port} (${sessionId})`,
      `basePath: ${config.basePath ?? '/'}`
    )

    return {
      sessionId,
      statusCode: ProtocolStatus.OK,
      detail: {
        fingerprint: '',
      },
    }
  }

  disconnect(sessionId: string): Promise<void> {
    try {
      const session = this.getClient(sessionId)
      session.controller.abort()
      session.agent.destroy()
    } catch {
      // 连接可能已断开，忽略错误
    } finally {
      sessionManager.unregister(sessionId)
      this.logOperation('disconnected', sessionId, '')
    }
    return Promise.resolve()
  }

  private getFullPath(sessionId: string, remotePath: string): string {
    const config = this.getSessionConfig(sessionId)
    const basePath = config?.basePath ?? '/'
    const normalizedRemote = remotePath.startsWith('/') ? remotePath.slice(1) : remotePath
    return path.posix.join(basePath, normalizedRemote)
  }

  async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const session = this.getClient(sessionId)
    const fullPath = this.getFullPath(sessionId, remotePath)

    try {
      const response = await session.client.getDirectoryContents(fullPath, {
        signal: session.controller.signal,
      })

      return response.map((item: FileStat): FileInfo => {
        const itemName = path.basename(item.filename)
        const absolutePath = this.joinPaths(remotePath, itemName)
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
    } catch (error) {
      this.logOperation('list failed', fullPath, '', error)
      throw error
    }
  }

  async mkdir(sessionId: string, dirPath: string): Promise<void> {
    const session = this.getClient(sessionId)
    const fullPath = this.getFullPath(sessionId, dirPath)

    try {
      await session.client.createDirectory(fullPath, {
        recursive: true,
        signal: session.controller.signal,
      })
      this.logOperation('mkdir', fullPath, '')
    } catch (error) {
      this.logOperation('mkdir failed', fullPath, '', error)
      throw error
    }
  }

  async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const session = this.getClient(sessionId)
    const fullOldPath = this.getFullPath(sessionId, file.absolutePath)
    const newPath = file.absolutePath.replace(/\/[^/]+$/, `/${newName}`)
    const fullNewPath = this.getFullPath(sessionId, newPath)

    try {
      await session.client.moveFile(fullOldPath, fullNewPath, { signal: session.controller.signal })
      this.logOperation(FileOperation.RENAME, file.name, newName)
    } catch (error) {
      this.logOperation('rename failed', file.name, newName, error)
      throw error
    }
  }

  async delete(sessionId: string, file: FileInfo): Promise<void> {
    const session = this.getClient(sessionId)
    const fullPath = this.getFullPath(sessionId, file.absolutePath)

    try {
      await session.client.deleteFile(fullPath, { signal: session.controller.signal })
      this.logOperation(FileOperation.DELETE, fullPath, '')
    } catch (error) {
      this.logOperation('delete failed', fullPath, '', error)
      throw error
    }
  }

  async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const session = this.getClient(sessionId)
    const sourcePath = file.absolutePath

    try {
      const fullSourcePath = this.getFullPath(sessionId, sourcePath)
      const fullTargetPath = this.getFullPath(sessionId, targetPath)

      await session.client.copyFile(fullSourcePath, fullTargetPath, {
        overwrite: true,
        signal: session.controller.signal,
      })
      this.logOperation('copy completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('copy failed', sourcePath, targetPath, error)
      throw error
    }
  }

  async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const session = this.getClient(sessionId)
    const sourcePath = file.absolutePath

    try {
      const fullSourcePath = this.getFullPath(sessionId, sourcePath)
      const fullTargetPath = this.getFullPath(sessionId, targetPath)

      await session.client.moveFile(fullSourcePath, fullTargetPath, {
        signal: session.controller.signal,
      })
      this.logOperation('move completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('move failed', sourcePath, targetPath, error)
      throw error
    }
  }

  async ping(sessionId: string): Promise<void> {
    const session = this.getClient(sessionId)
    const config = this.getSessionConfig(sessionId)
    const path = config?.basePath ?? '/'
    await session.client.stat(path)
  }
}

export default WebdavProtocol
