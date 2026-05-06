import Client from 'ssh2-sftp-client'
import logger from '../logger'

interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modifyTime: number
  permissions?: string
  owner?: string
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
      // 确保返回完全纯净、可序列化的对象
      return list.map((item: any) => {
        // 调试：输出原始数据
        logger.debug(`Processing file: ${item.name}`)
        logger.debug(`rights: ${JSON.stringify(item.rights)}`)
        logger.debug(`longname: ${item.longname}`)

        // 从 rights 对象构建权限字符串 (如 rwxr-xr-x)
        const rights = item.rights || {}
        // 确保每个部分都是 3 个字符，不足的用 '-' 补齐
        const padPermission = (perm: string | undefined) => {
          if (!perm) return '---'
          const p = perm.padEnd(3, '-')
          return p.substring(0, 3)
        }
        const permissions = `${padPermission(rights.user)}${padPermission(rights.group)}${padPermission(rights.other)}`
        logger.debug(`Final permissions: ${permissions}`)

        // 从 longname 中提取所有者用户名
        let owner: string | undefined
        if (item.longname) {
          const parts = item.longname.split(/\s+/)
          logger.debug(`longname parts: ${JSON.stringify(parts)}`)
          if (parts.length >= 4) {
            owner = parts[2]
          }
        }
        logger.debug(`Final owner: ${owner}`)

        const safeFileInfo: FileInfo = {
          name: String(item.name || ''),
          type: item.type === 'd' ? 'directory' : 'file',
          size: Number(item.size || 0),
          modifyTime: item.modifyTime ? new Date(item.modifyTime).getTime() : 0,
          permissions: permissions !== '-----------' ? permissions : undefined,
          owner,
        }
        return safeFileInfo
      })
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
      try {
        await handle.client.delete(path)
      } catch (deleteError: any) {
        if (deleteError.code === 4) {
          await this.deleteDirectoryRecursive(handle.client, path)
        } else {
          throw deleteError
        }
      }

      logger.info(`SFTP delete: ${path}`)
    } catch (error) {
      logger.error(`SFTP delete failed: ${path} - ${error}`)
      throw error
    }
  }

  private async deleteDirectoryRecursive(client: any, dirPath: string): Promise<void> {
    const list = await client.list(dirPath)

    for (const item of list) {
      const itemPath = `${dirPath}/${item.name}`
      const stats = await client.stat(itemPath)

      const isDirectory = stats.type === 'd' || stats.isDirectory?.() === true

      if (isDirectory) {
        await this.deleteDirectoryRecursive(client, itemPath)
      } else {
        await client.delete(itemPath)
      }
    }

    await client.rmdir(dirPath)
  }

  private async getLocalFileSize(localPath: string): Promise<number> {
    const fs = await import('fs')
    const stats = await fs.promises.stat(localPath)
    return stats.size
  }
}

export default SftpProtocol
