import { createClient } from 'webdav'
import path from 'path'
import { FileInfo, ConnectionConfig } from '../../shared/types.js'
import { BaseProtocolImpl } from './BaseProtocol.js'
import { generateSessionId } from '../utils/session.js'
import type { WebDAVClient, FileStat } from 'webdav'

export class WebdavProtocol extends BaseProtocolImpl<WebDAVClient> {
  protected protocolName = 'webdav'

  async connect(config: ConnectionConfig): Promise<string> {
    const sessionId = generateSessionId('webdav')
    const useScheme = config.scheme || 'https'

    const url = `${useScheme}://${config.host}:${config.port}`

    const client = createClient(url, {
      username: config.username,
      password: config.password,
      httpsAgent:
        useScheme === 'https' && config.rejectUnauthorized === false
          ? new (await import('https')).Agent({ rejectUnauthorized: false })
          : undefined,
    })

    // 验证连接是否有效 - 尝试列出根目录
    try {
      const testPath = config.basePath || '/'
      await client.getDirectoryContents(testPath)
    } catch (error) {
      this.logOperation('connection failed', `${config.host}:${config.port}`, '', error)
      throw error
    }

    this.sessions.set(sessionId, {
      client,
      config,
    })
    this.logOperation(
      'connected',
      `${config.host}:${config.port} (${sessionId})`,
      `basePath: ${config.basePath || '/'}`,
      `rejectUnauthorized: ${config.rejectUnauthorized !== false}`
    )

    return sessionId
  }

  private getFullPath(sessionId: string, remotePath: string): string {
    const handle = this.getSessionHandle(sessionId)
    const basePath = handle.config.basePath || '/'
    const normalizedBase = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
    const normalizedRemote = remotePath.startsWith('/') ? remotePath : `/${remotePath}`
    if (normalizedBase === '/') {
      return normalizedRemote
    }
    return `${normalizedBase}${normalizedRemote}`
  }

  async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const handle = this.getSessionHandle(sessionId)
    const fullPath = this.getFullPath(sessionId, remotePath)

    try {
      const response = await handle.client.getDirectoryContents(fullPath)

      const result = (response as FileStat[]).map((item: FileStat) => {
        const itemName = path.basename(item.filename)
        const absolutePath = this.joinPaths(remotePath, itemName)
        const fileType = item.type === 'directory' ? 'directory' : 'file'
        return {
          name: itemName,
          type: fileType as 'file' | 'directory',
          size: item.size || 0,
          modifyTime: item.lastmod ? new Date(item.lastmod).getTime() : 0,
          absolutePath,
        }
      })

      return result
    } catch (error) {
      this.logOperation('list failed', fullPath, '', error)
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

      await handle.client.putFileContents(fullPath, readStream, {
        onUploadProgress: (progress: any) => {
          if (abortState.aborted) {
            readStream.destroy()
            throw new Error('Upload cancelled')
          }
          transferred = progress.transferred || 0
          onProgress(this.calculateProgress(transferred, totalSize))
        },
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

  async downloadFile(
    sessionId: string,
    file: FileInfo,
    localPath: string,
    onProgress: (percent: number) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const fullPath = this.getFullPath(sessionId, file.absolutePath)
    const abortState = this.setupAbortHandler(signal)

    try {
      const fs = await import('fs')

      const stat = (await handle.client.stat(fullPath)) as FileStat
      const totalSize = stat.size || 0
      let transferred = 0

      const writeStream = fs.createWriteStream(localPath)

      if (signal) {
        signal.addEventListener('abort', () => {
          writeStream.destroy()
        })
      }

      await new Promise<void>((resolve, reject) => {
        const readStream = handle.client.createReadStream(fullPath)

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

  async mkdir(sessionId: string, path: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const fullPath = this.getFullPath(sessionId, path)

    try {
      await handle.client.createDirectory(fullPath, { recursive: true })
      this.logOperation('mkdir', fullPath, '')
    } catch (error) {
      this.logOperation('mkdir failed', fullPath, '', error)
      throw error
    }
  }

  async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    const fullOldPath = this.getFullPath(sessionId, file.absolutePath)
    const newPath = file.absolutePath.replace(/\/[^/]+$/, `/${newName}`)
    const fullNewPath = this.getFullPath(sessionId, newPath)

    try {
      await handle.client.moveFile(fullOldPath, fullNewPath)
      this.logOperation('rename', file.name, newName)
    } catch (error) {
      this.logOperation('rename failed', file.name, newName, error)
      throw error
    }
  }

  async delete(sessionId: string, files: FileInfo[]): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    try {
      for (const file of files) {
        const fullPath = this.getFullPath(sessionId, file.absolutePath)
        // webdav-client 的 deleteFile 支持删除文件和文件夹
        await handle.client.deleteFile(fullPath)
        this.logOperation('delete', fullPath, '')
      }
    } catch (error) {
      this.logOperation('delete failed', '', '', error)
      throw error
    }
  }

  async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const sourcePath = file.absolutePath

    try {
      const fullSourcePath = this.getFullPath(sessionId, sourcePath)
      const fullTargetPath = this.getFullPath(sessionId, targetPath)

      // webdav-client 的 copyFile 默认支持递归复制文件夹（Depth: "infinity"）
      await handle.client.copyFile(fullSourcePath, fullTargetPath)
      this.logOperation('copy completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('copy failed', sourcePath, targetPath, error)
      throw error
    }
  }

  async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)
    const sourcePath = file.absolutePath

    try {
      const fullSourcePath = this.getFullPath(sessionId, sourcePath)
      const fullTargetPath = this.getFullPath(sessionId, targetPath)

      // webdav-client 的 moveFile 默认支持递归移动文件夹（Depth: "infinity"）
      await handle.client.moveFile(fullSourcePath, fullTargetPath)
      this.logOperation('move completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('move failed', sourcePath, targetPath, error)
      throw error
    }
  }
}

export default WebdavProtocol
