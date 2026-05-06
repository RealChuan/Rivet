import Client from 'ssh2-sftp-client'
import logger from '../logger'

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
    port: number
    username: string
    password?: string
    privateKey?: string
  }
}

export class SftpProtocol {
  private sessions: Map<string, SessionHandle> = new Map()

  async connect(config: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  }): Promise<string> {
    const client = new Client()
    const sessionId = `sftp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    try {
      await client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        readyTimeout: 20000,
      })

      this.sessions.set(sessionId, { client, config })
      logger.info(`SFTP connected: ${config.host}:${config.port} (${sessionId})`)

      return sessionId
    } catch (error) {
      logger.error(`SFTP connection failed: ${error}`)
      await client.end()
      throw error
    }
  }

  async disconnect(sessionId: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (handle) {
      await handle.client.end()
      this.sessions.delete(sessionId)
      logger.info(`SFTP disconnected: ${sessionId}`)
    }
  }

  async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    try {
      const list = await handle.client.list(remotePath)
      return list.map((item: any) => ({
        name: item.name,
        type: item.type === 'd' ? 'directory' : 'file',
        size: item.size || 0,
        modifyTime: item.modifyTime ? new Date(item.modifyTime).getTime() : 0,
      }))
    } catch (error) {
      logger.error(`SFTP list failed: ${remotePath} - ${error}`)
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

    try {
      const totalSize = await this.getLocalFileSize(localPath)
      let transferred = 0

      await handle.client.put(localPath, remotePath, {
        step: (uploaded: number) => {
          if (aborted) {
            throw new Error('Upload cancelled')
          }
          transferred += uploaded
          const percent = totalSize > 0 ? Math.round((transferred / totalSize) * 100) : 100
          onProgress(Math.min(percent, 100))
        },
      })

      if (aborted) {
        throw new Error('Upload cancelled')
      }

      logger.info(`SFTP uploaded: ${localPath} -> ${remotePath}`)
    } catch (error) {
      if (aborted) {
        logger.info(`SFTP upload cancelled: ${localPath}`)
      } else {
        logger.error(`SFTP upload failed: ${localPath} -> ${remotePath} - ${error}`)
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

    try {
      const stats = await handle.client.stat(remotePath)
      const totalSize = stats.size || 0
      let transferred = 0

      await handle.client.get(remotePath, localPath, {
        step: (uploaded: number) => {
          if (aborted) {
            throw new Error('Download cancelled')
          }
          transferred += uploaded
          const percent = totalSize > 0 ? Math.round((transferred / totalSize) * 100) : 100
          onProgress(Math.min(percent, 100))
        },
      })

      if (aborted) {
        throw new Error('Download cancelled')
      }

      logger.info(`SFTP downloaded: ${remotePath} -> ${localPath}`)
    } catch (error) {
      if (aborted) {
        logger.info(`SFTP download cancelled: ${remotePath}`)
      } else {
        logger.error(`SFTP download failed: ${remotePath} -> ${localPath} - ${error}`)
      }
      throw error
    }
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    try {
      await handle.client.mkdir(path, true)
      logger.info(`SFTP mkdir: ${path}`)
    } catch (error) {
      logger.error(`SFTP mkdir failed: ${path} - ${error}`)
      throw error
    }
  }

  async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    try {
      await handle.client.rename(oldPath, newPath)
      logger.info(`SFTP rename: ${oldPath} -> ${newPath}`)
    } catch (error) {
      logger.error(`SFTP rename failed: ${oldPath} -> ${newPath} - ${error}`)
      throw error
    }
  }

  async delete(sessionId: string, path: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (!handle) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    try {
      await handle.client.delete(path)
      logger.info(`SFTP delete: ${path}`)
    } catch (error) {
      logger.error(`SFTP delete failed: ${path} - ${error}`)
      throw error
    }
  }

  private async getLocalFileSize(localPath: string): Promise<number> {
    const fs = await import('fs')
    const stats = await fs.promises.stat(localPath)
    return stats.size
  }
}

export default SftpProtocol
