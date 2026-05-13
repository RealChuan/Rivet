import { createClient, type WebDAVClient, type FileStat } from 'webdav'
import path from 'path'
import http from 'node:http'
import https from 'node:https'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { generateSessionId } from '@shared/utils/index.js'
import { ProtocolStatus } from '@shared/constants/index.js'
import { BaseProtocolImpl } from './base.js'
import { sessionManager } from './session-manager.js'

interface WebDAVSession {
  client: WebDAVClient
  controller: AbortController
  httpAgent?: http.Agent
  httpsAgent?: https.Agent
}

export class WebdavProtocol extends BaseProtocolImpl<WebDAVSession> {
  readonly protocolType = 'webdav' as const

  override async connect(config: ConnectionConfig) {
    const sessionId = generateSessionId('webdav')
    const useScheme = config.scheme ?? 'https'
    const url = `${useScheme}://${config.host}:${config.port}`

    const httpAgent = new http.Agent({
      keepAlive: true,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: 30000,
    })

    const httpsAgent = new https.Agent({
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
      httpAgent: useScheme === 'http' ? httpAgent : undefined,
      httpsAgent: useScheme === 'https' ? httpsAgent : undefined,
    })

    try {
      const testPath = config.basePath ?? '/'
      await client.getDirectoryContents(testPath, { signal: controller.signal })
    } catch (error) {
      this.logOperation('connection failed', `${config.host}:${config.port}`, '', error)
      httpAgent.destroy()
      httpsAgent.destroy()
      throw error
    }

    const session: WebDAVSession = { client, controller, httpAgent, httpsAgent }
    sessionManager.register(sessionId, session, config, 'webdav')
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

  override disconnect(sessionId: string): Promise<void> {
    try {
      const session = this.getClient(sessionId)
      // 第一步：取消所有进行中的请求
      session.controller.abort()
      // 第二步：销毁连接池
      session.httpAgent?.destroy()
      session.httpsAgent?.destroy()
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

  override async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
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

  override async uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const session = this.getClient(sessionId)
    const fullPath = this.getFullPath(sessionId, remotePath)
    const abortState = this.setupAbortHandler(signal)

    try {
      const fs = await import('fs')
      const totalSize = (await fs.promises.stat(localPath)).size
      let transferred = 0

      const readStream = fs.createReadStream(localPath)

      if (signal) {
        signal.addEventListener('abort', () => {
          readStream.destroy()
        })
      }

      await session.client.putFileContents(fullPath, readStream, {
        onUploadProgress: (progress: { loaded: number }) => {
          if (abortState.aborted) {
            readStream.destroy()
            throw new Error('Upload cancelled')
          }
          transferred = progress.loaded ?? 0
          onProgress(this.calculateProgress(transferred, totalSize))
        },
        signal: session.controller.signal,
      })

      if (abortState.aborted) {
        throw new Error('Upload cancelled')
      }

      this.logOperation('uploaded', localPath, fullPath)
    } catch (error) {
      if (abortState.aborted) {
        this.logCancelled('upload', localPath)
      } else {
        this.logOperation('upload failed', localPath, fullPath, error)
      }
      throw error
    }
  }

  override async downloadFile(
    sessionId: string,
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const session = this.getClient(sessionId)
    const fullPath = this.getFullPath(sessionId, file.absolutePath)
    const abortState = this.setupAbortHandler(signal)

    try {
      const fs = await import('fs')
      const stat = (await session.client.stat(fullPath, {
        signal: session.controller.signal,
      })) as FileStat
      const totalSize = stat.size || 0
      let transferred = 0

      const writeStream = fs.createWriteStream(localPath)

      if (signal) {
        signal.addEventListener('abort', () => {
          writeStream.destroy()
        })
      }

      await new Promise<void>((resolve, reject) => {
        const readStream = session.client.createReadStream(fullPath, {
          signal: session.controller.signal,
        })

        readStream
          .on('data', (chunk: Buffer) => {
            if (abortState.aborted) {
              writeStream.destroy()
              reject(new Error('Download cancelled'))
              return
            }
            transferred += chunk.length
            onProgress(this.calculateProgress(transferred, totalSize))
          })
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject)
      })

      if (abortState.aborted) {
        throw new Error('Download cancelled')
      }

      this.logOperation('downloaded', fullPath, localPath)
    } catch (error) {
      if (abortState.aborted) {
        this.logCancelled('download', file.absolutePath)
      } else {
        this.logOperation('download failed', fullPath, localPath, error)
      }
      throw error
    }
  }

  override async mkdir(sessionId: string, dirPath: string): Promise<void> {
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

  override async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const session = this.getClient(sessionId)
    const fullOldPath = this.getFullPath(sessionId, file.absolutePath)
    const newPath = file.absolutePath.replace(/\/[^/]+$/, `/${newName}`)
    const fullNewPath = this.getFullPath(sessionId, newPath)

    try {
      await session.client.moveFile(fullOldPath, fullNewPath, { signal: session.controller.signal })
      this.logOperation('rename', file.name, newName)
    } catch (error) {
      this.logOperation('rename failed', file.name, newName, error)
      throw error
    }
  }

  override async delete(sessionId: string, files: FileInfo[]): Promise<void> {
    const session = this.getClient(sessionId)

    try {
      for (const file of files) {
        const fullPath = this.getFullPath(sessionId, file.absolutePath)
        await session.client.deleteFile(fullPath, { signal: session.controller.signal })
        this.logOperation('delete', fullPath, '')
      }
    } catch (error) {
      this.logOperation('delete failed', '', '', error)
      throw error
    }
  }

  override async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
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

  override async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
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

  override async ping(sessionId: string): Promise<void> {
    const session = this.getClient(sessionId)
    const config = this.getSessionConfig(sessionId)
    const path = config?.basePath ?? '/'
    await session.client.stat(path)
  }
}

export default WebdavProtocol
