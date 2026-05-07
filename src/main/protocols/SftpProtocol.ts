import Client from 'ssh2-sftp-client'
import logger from '../logger'
import { FileInfo, BaseProtocolImpl } from './BaseProtocol'
import { generateSessionId } from '../utils'

export class SftpProtocol extends BaseProtocolImpl<Client> {
  async connect(config: {
    host: string
    port: number
    username: string
    password?: string
    privateKey?: string
  }): Promise<string> {
    const client = new Client()
    const sessionId = generateSessionId('sftp')

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
    }
    super.disconnect(sessionId)
    logger.info(`SFTP disconnected: ${sessionId}`)
  }

  async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const handle = this.getSessionHandle(sessionId)

    try {
      const list = await handle.client.list(remotePath)
      return list.map((item: any) => {
        const rights = item.rights || {}
        const padPermission = (perm: string | undefined) => {
          if (!perm) return '---'
          const p = perm.padEnd(3, '-')
          return p.substring(0, 3)
        }
        const permissions = `${padPermission(rights.user)}${padPermission(rights.group)}${padPermission(rights.other)}`

        let owner: string | undefined
        if (item.longname) {
          const parts = item.longname.split(/\s+/)
          if (parts.length >= 4) {
            owner = parts[2]
          }
        }

        const absolutePath = this.joinPaths(remotePath, item.name)
        const safeFileInfo: FileInfo = {
          name: String(item.name || ''),
          type: item.type === 'd' ? 'directory' : 'file',
          size: Number(item.size || 0),
          modifyTime: item.modifyTime ? new Date(item.modifyTime).getTime() : 0,
          permissions: permissions !== '-----------' ? permissions : undefined,
          owner,
          absolutePath,
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
    const handle = this.getSessionHandle(sessionId)

    let aborted = false
    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true
      })
    }

    try {
      const fs = await import('fs')
      const totalSize = (await fs.promises.stat(localPath)).size

      await handle.client.fastPut(localPath, remotePath, {
        step: (totalTransferred: number, _chunk: number, _total: number) => {
          if (aborted) {
            throw new Error('Upload cancelled')
          }
          onProgress(this.calculateProgress(totalTransferred, totalSize))
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
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    let aborted = false
    if (signal) {
      signal.addEventListener('abort', () => {
        aborted = true
      })
    }

    try {
      const stats = await handle.client.stat(file.absolutePath)
      const totalSize = stats.size || 0

      await handle.client.fastGet(file.absolutePath, localPath, {
        step: (totalTransferred: number, _chunk: number, _total: number) => {
          if (aborted) {
            throw new Error('Download cancelled')
          }
          onProgress(this.calculateProgress(totalTransferred, totalSize))
        },
      })

      if (aborted) {
        throw new Error('Download cancelled')
      }

      logger.info(`SFTP downloaded: ${file.absolutePath} -> ${localPath}`)
    } catch (error) {
      if (aborted) {
        logger.info(`SFTP download cancelled: ${file.absolutePath}`)
      } else {
        logger.error(`SFTP download failed: ${file.absolutePath} -> ${localPath} - ${error}`)
      }
      throw error
    }
  }

  async mkdir(sessionId: string, path: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    try {
      await handle.client.mkdir(path, true)
      logger.info(`SFTP mkdir: ${path}`)
    } catch (error) {
      logger.error(`SFTP mkdir failed: ${path} - ${error}`)
      throw error
    }
  }

  async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    try {
      const newPath = file.absolutePath.replace(/\/[^/]+$/, `/${newName}`)
      await handle.client.rename(file.absolutePath, newPath)
      logger.info(`SFTP rename: ${file.name} -> ${newName}`)
    } catch (error) {
      logger.error(`SFTP rename failed: ${file.name} -> ${newName} - ${error}`)
      throw error
    }
  }

  async delete(sessionId: string, files: FileInfo[]): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    try {
      for (const file of files) {
        try {
          await handle.client.delete(file.absolutePath)
        } catch (deleteError: any) {
          if (deleteError.code === 4) {
            await this.deleteDirectoryRecursive(handle.client, file.absolutePath)
          } else {
            throw deleteError
          }
        }

        logger.info(`SFTP delete: ${file.absolutePath}`)
      }
    } catch (error) {
      logger.error(`SFTP delete failed - ${error}`)
      throw error
    }
  }

  private async deleteDirectoryRecursive(client: Client, dirPath: string): Promise<void> {
    const list = await client.list(dirPath)

    for (const item of list) {
      const itemPath = this.joinPaths(dirPath, item.name)

      if (item.type === 'd') {
        await this.deleteDirectoryRecursive(client, itemPath)
      } else {
        await client.delete(itemPath)
      }
    }

    await client.rmdir(dirPath)
  }

  async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const sourcePath = file.absolutePath

    try {
      if (file.type === 'directory') {
        await this.copyDirectory(handle.client, sourcePath, targetPath)
      } else {
        await this.copyFile(handle.client, sourcePath, targetPath)
      }
      logger.info(`SFTP copy completed: ${sourcePath} -> ${targetPath}`)
    } catch (error) {
      logger.error(`SFTP copy failed: ${sourcePath} -> ${targetPath} - ${error}`)
      throw error
    }
  }

  async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const sourcePath = file.absolutePath

    try {
      try {
        await handle.client.stat(targetPath)
        await handle.client.delete(targetPath)
      } catch {}
      await handle.client.rename(sourcePath, targetPath)
      logger.info(`SFTP move completed: ${sourcePath} -> ${targetPath}`)
    } catch (error) {
      logger.error(`SFTP move failed: ${sourcePath} -> ${targetPath} - ${error}`)
      throw error
    }
  }

  private async copyFile(client: Client, sourcePath: string, targetPath: string): Promise<void> {
    await client.rcopy(sourcePath, targetPath)
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
          await this.copyFile(client, sourceItemPath, targetItemPath)
        }
      }
    }
  }
}

export default SftpProtocol
