import { createClient } from 'webdav'
import logger from '../logger'
import path from 'path'

interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modifyTime: number
}

interface SessionHandle {
  client: any
  config: {
    host: string
    username: string
    password?: string
    basePath?: string
  }
}

export class WebdavProtocol {
  private sessions: Map<string, SessionHandle> = new Map()

  async connect(config: {
    host: string
    port: number
    username: string
    password?: string
    basePath?: string
  }): Promise<string> {
    const sessionId = `webdav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const url =
      config.port === 443 || config.host.startsWith('https://')
        ? config.host
        : `http://${config.host}:${config.port}`

    const client = createClient(url, {
      username: config.username,
      password: config.password,
    })

    this.sessions.set(sessionId, {
      client,
      config: {
        host: url,
        username: config.username,
        password: config.password,
        basePath: config.basePath,
      },
    })
    logger.info(
      `WebDAV connected: ${config.host}:${config.port} (${sessionId}), basePath: ${config.basePath || '/'}`
    )

    return sessionId
  }

  private getFullPath(handle: SessionHandle, remotePath: string): string {
    const basePath = handle.config.basePath || '/'
    const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    const normalizedRemote = remotePath.startsWith('/') ? remotePath : `/${remotePath}`
    if (normalizedBase === '/') {
      return normalizedRemote
    }
    return `${normalizedBase}${normalizedRemote}`
  }

  async disconnect(sessionId: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (handle) {
      this.sessions.delete(sessionId)
      logger.info(`WebDAV disconnected: ${sessionId}`)
    }
  }

  async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const fullPath = this.getFullPath(handle, remotePath)
    try {
      const response = await handle.client.getDirectoryContents(fullPath)
      return response.map((item: any) => ({
        name: path.basename(item.filename),
        type: item.type === 'directory' ? 'directory' : 'file',
        size: item.size || 0,
        modifyTime: item.lastModified ? new Date(item.lastModified).getTime() : 0,
      }))
    } catch (error) {
      logger.error(`WebDAV list failed: ${fullPath} - ${error}`)
      throw error
    }
  }

  async uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    let aborted = false
    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true
      })
    }

    const fullPath = this.getFullPath(handle, remotePath)
    try {
      const fs = await import('fs')
      const totalSize = (await fs.promises.stat(localPath)).size
      let transferred = 0

      const readStream = fs.createReadStream(localPath)

      await handle.client.putFileContents(fullPath, readStream, {
        onUploadProgress: (progress: any) => {
          if (aborted) {
            readStream.destroy()
            throw new Error('Upload cancelled')
          }
          transferred = progress.transferred || 0
          const percent = totalSize > 0 ? Math.round((transferred / totalSize) * 100) : 100
          onProgress(Math.min(percent, 100))
        },
      })

      if (aborted) {
        throw new Error('Upload cancelled')
      }

      logger.info(`WebDAV uploaded: ${localPath} -> ${fullPath}`)
    } catch (error) {
      if (aborted) {
        logger.info(`WebDAV upload cancelled: ${localPath}`)
      } else {
        logger.error(`WebDAV upload failed: ${localPath} -> ${fullPath} - ${error}`)
      }
      throw error
    }
  }

  async downloadFile(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    let aborted = false
    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true
      })
    }

    const fullPath = this.getFullPath(handle, remotePath)
    try {
      const fs = await import('fs')

      const stat = await handle.client.stat(fullPath)
      const totalSize = stat.size || 0
      let transferred = 0

      const writeStream = fs.createWriteStream(localPath)

      await new Promise<void>((resolve, reject) => {
        handle.client
          .createReadStream(fullPath)
          .on('data', (chunk: Buffer) => {
            if (aborted) {
              writeStream.destroy()
              reject(new Error('Download cancelled'))
              return
            }
            transferred += chunk.length
            const percent = totalSize > 0 ? Math.round((transferred / totalSize) * 100) : 100
            onProgress(Math.min(percent, 100))
          })
          .pipe(writeStream)
          .on('finish', resolve)
          .on('error', reject)
      })

      if (aborted) {
        throw new Error('Download cancelled')
      }

      logger.info(`WebDAV downloaded: ${fullPath} -> ${localPath}`)
    } catch (error) {
      if (aborted) {
        logger.info(`WebDAV download cancelled: ${remotePath}`)
      } else {
        logger.error(`WebDAV download failed: ${fullPath} -> ${localPath} - ${error}`)
      }
      throw error
    }
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const fullPath = this.getFullPath(handle, path)
    try {
      await handle.client.createDirectory(fullPath)
      logger.info(`WebDAV mkdir: ${fullPath}`)
    } catch (error) {
      logger.error(`WebDAV mkdir failed: ${fullPath} - ${error}`)
      throw error
    }
  }

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const fullOldPath = this.getFullPath(handle, oldPath)
    const fullNewPath = this.getFullPath(handle, newPath)
    try {
      await handle.client.move(fullOldPath, fullNewPath)
      logger.info(`WebDAV rename: ${fullOldPath} -> ${fullNewPath}`)
    } catch (error) {
      logger.error(`WebDAV rename failed: ${fullOldPath} -> ${fullNewPath} - ${error}`)
      throw error
    }
  }

  async delete(sessionId: string, path: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    const fullPath = this.getFullPath(handle, path)
    try {
      const stat = await handle.client.stat(fullPath)

      if (stat.type === 'directory') {
        await handle.client.deleteDirectory(fullPath, { recursive: true })
      } else {
        await handle.client.deleteFile(fullPath)
      }

      logger.info(`WebDAV delete: ${fullPath}`)
    } catch (error) {
      logger.error(`WebDAV delete failed: ${fullPath} - ${error}`)
      throw error
    }
  }
}

export default WebdavProtocol
