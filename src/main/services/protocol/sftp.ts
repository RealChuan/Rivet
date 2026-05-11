import Client from 'ssh2-sftp-client'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { generateSessionId } from '@shared/utils/index.js'
import { BaseProtocolImpl } from './base.js'

export class SftpProtocol extends BaseProtocolImpl<Client> {
  protected protocolName = 'sftp'

  override async connect(config: ConnectionConfig): Promise<string> {
    const client = new Client()
    const sessionId = generateSessionId('sftp')

    try {
      await client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password ?? '',
        readyTimeout: 20000,
      })

      this.sessions.set(sessionId, { client, config })
      this.logOperation('connected', `${config.host}:${config.port}`, sessionId)

      return sessionId
    } catch (error) {
      this.logOperation('connection failed', '', '', error)
      await client.end()
      throw error
    }
  }

  override async disconnect(sessionId: string): Promise<void> {
    const handle = this.sessions.get(sessionId)
    if (handle) {
      await handle.client.end()
    }
    await super.disconnect(sessionId)
    this.logOperation('disconnected', sessionId, '')
  }

  override async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const handle = this.getSessionHandle(sessionId)

    try {
      const list = (await handle.client.list(remotePath)) as unknown as Array<{
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
        const safeFileInfo: FileInfo = {
          name: itemName,
          type: fileType,
          size: typeof item.size === 'number' ? item.size : 0,
          modifyTime: item.modifyTime ? new Date(item.modifyTime).getTime() : 0,
          permissions: permissions !== '-----------' ? permissions : '',
          owner,
          absolutePath,
        }
        return safeFileInfo
      })
    } catch (error) {
      this.logOperation('list failed', remotePath, '', error)
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
    const handle = this.getSessionHandle(sessionId)
    const abortState = this.setupAbortHandler(signal)

    try {
      const fs = await import('fs')
      const totalSize = (await fs.promises.stat(localPath)).size

      await handle.client.fastPut(localPath, remotePath, {
        step: (totalTransferred: number) => {
          if (abortState.aborted) {
            throw new Error('Upload cancelled')
          }
          onProgress(this.calculateProgress(totalTransferred, totalSize))
        },
      })

      if (abortState.aborted) {
        throw new Error('Upload cancelled')
      }

      this.logOperation('uploaded', localPath, remotePath)
    } catch (error) {
      if (abortState.aborted) {
        this.logCancelled('upload', localPath)
      } else {
        this.logOperation('upload failed', localPath, remotePath, error)
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
    const handle = this.getSessionHandle(sessionId)
    const abortState = this.setupAbortHandler(signal)

    try {
      const totalSize = file.size || 0

      await handle.client.fastGet(file.absolutePath, localPath, {
        step: (totalTransferred: number) => {
          if (abortState.aborted) {
            throw new Error('Download cancelled')
          }
          onProgress(this.calculateProgress(totalTransferred, totalSize))
        },
      })

      if (abortState.aborted) {
        throw new Error('Download cancelled')
      }

      this.logOperation('downloaded', file.absolutePath, localPath)
    } catch (error) {
      if (abortState.aborted) {
        this.logCancelled('download', file.absolutePath)
      } else {
        this.logOperation('download failed', file.absolutePath, localPath, error)
      }
      throw error
    }
  }

  override async mkdir(sessionId: string, path: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    try {
      await handle.client.mkdir(path, true)
      this.logOperation('mkdir', path, '')
    } catch (error) {
      this.logOperation('mkdir failed', path, '', error)
      throw error
    }
  }

  override async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    try {
      const newPath = file.absolutePath.replace(/\/[^/]+$/, `/${newName}`)
      await handle.client.rename(file.absolutePath, newPath)
      this.logOperation('rename', file.name, newName)
    } catch (error) {
      this.logOperation('rename failed', file.name, newName, error)
      throw error
    }
  }

  override async delete(sessionId: string, files: FileInfo[]): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    try {
      for (const file of files) {
        if (file.type === 'directory') {
          await handle.client.rmdir(file.absolutePath, true)
        } else {
          await handle.client.delete(file.absolutePath)
        }
        this.logOperation('delete', file.absolutePath, '')
      }
    } catch (error) {
      this.logOperation('delete failed', '', '', error)
      throw error
    }
  }

  override async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const sourcePath = file.absolutePath

    try {
      if (file.type === 'directory') {
        await this.copyDirectory(handle.client, sourcePath, targetPath)
      } else {
        await handle.client.rcopy(sourcePath, targetPath)
      }
      this.logOperation('copy completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('copy failed', sourcePath, targetPath, error)
      throw error
    }
  }

  override async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const sourcePath = file.absolutePath

    try {
      try {
        await handle.client.stat(targetPath)
        await handle.client.delete(targetPath)
      } catch {
        // ignore if target does not exist
      }
      await handle.client.rename(sourcePath, targetPath)
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
}

export default SftpProtocol
