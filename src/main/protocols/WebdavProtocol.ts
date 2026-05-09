import { createClient } from 'webdav'
import path from 'path'
import { FileInfo } from '../../shared/types.js'
import { BaseProtocolImpl } from './BaseProtocol.js'
import { generateSessionId } from '../utils/session.js'

export class WebdavProtocol extends BaseProtocolImpl<any> {
  protected protocolName = 'webdav'
  async connect(config: {
    host: string
    port: number
    username: string
    password?: string
    basePath?: string
    scheme?: 'http' | 'https'
    rejectUnauthorized?: boolean
  }): Promise<string> {
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

    this.sessions.set(sessionId, {
      client,
      config: {
        host: url,
        username: config.username,
        password: config.password,
        basePath: config.basePath,
      },
    })
    this.logOperation(
      'connected',
      `${config.host}:${config.port} (${sessionId})`,
      `basePath: ${config.basePath || '/'}`,
      `rejectUnauthorized: ${config.rejectUnauthorized !== false}`
    )

    return sessionId
  }

  private getFullPath(remotePath: string): string {
    const handle = this.sessions.values().next().value
    if (!handle) return remotePath

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
    const fullPath = this.getFullPath(remotePath)

    try {
      const response = await handle.client.getDirectoryContents(fullPath)
      console.log(`[WebDAV] list remotePath: ${remotePath}, fullPath: ${fullPath}`)
      console.log(`[WebDAV] raw response items:`)
      response.forEach((item: any) => {
        console.log(
          `  - ${item.filename} (type: ${item.type}, basename: ${path.basename(item.filename)})`
        )
      })

      const result = response.map((item: any) => {
        const itemName = path.basename(item.filename)
        const absolutePath = this.joinPaths(remotePath, itemName)
        return {
          name: itemName,
          type: item.type === 'directory' ? 'directory' : 'file',
          size: item.size || 0,
          modifyTime: item.lastModified ? new Date(item.lastModified).getTime() : 0,
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
    const fullPath = this.getFullPath(remotePath)
    const abortState = this.setupAbortHandler(signal)

    try {
      const fs = await import('fs')
      const totalSize = (await fs.promises.stat(localPath)).size
      let transferred = 0

      const readStream = fs.createReadStream(localPath)

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
    const fullPath = this.getFullPath(file.absolutePath)
    const abortState = this.setupAbortHandler(signal)

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
    const fullPath = this.getFullPath(path)

    try {
      await handle.client.createDirectory(fullPath)
      this.logOperation('mkdir', fullPath, '')
    } catch (error) {
      this.logOperation('mkdir failed', fullPath, '', error)
      throw error
    }
  }

  async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const handle = this.getSessionHandle(sessionId)

    const fullOldPath = this.getFullPath(file.absolutePath)
    const newPath = file.absolutePath.replace(/\/[^/]+$/, `/${newName}`)
    const fullNewPath = this.getFullPath(newPath)

    try {
      await handle.client.move(fullOldPath, fullNewPath)
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
        const fullPath = this.getFullPath(file.absolutePath)
        if (file.type === 'directory') {
          await handle.client.deleteDirectory(fullPath, { recursive: true })
        } else {
          await handle.client.deleteFile(fullPath)
        }

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
      const fullSourcePath = this.getFullPath(sourcePath)
      const fullTargetPath = this.getFullPath(targetPath)

      if (file.type === 'directory') {
        await this.copyDirectory(sessionId, handle.client, sourcePath, targetPath)
      } else {
        await handle.client.copyFile(fullSourcePath, fullTargetPath, { overwrite: true })
      }
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
      const fullSourcePath = this.getFullPath(sourcePath)
      const fullTargetPath = this.getFullPath(targetPath)

      if (file.type === 'directory') {
        await this.moveDirectory(sessionId, handle.client, sourcePath, targetPath)
      } else {
        await handle.client.move(fullSourcePath, fullTargetPath, { overwrite: true })
      }
      this.logOperation('move completed', sourcePath, targetPath)
    } catch (error) {
      this.logOperation('move failed', sourcePath, targetPath, error)
      throw error
    }
  }

  private async moveDirectory(
    sessionId: string,
    client: any,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    const fullSourcePath = this.getFullPath(sourcePath)
    const fullTargetPath = this.getFullPath(targetPath)

    await client.createDirectory(fullTargetPath, { recursive: true })
    const list = await client.getDirectoryContents(fullSourcePath)

    for (const item of list) {
      const itemName = path.basename(item.filename)
      const childSourcePath = this.joinPaths(sourcePath, itemName)
      const childTargetPath = this.joinPaths(targetPath, itemName)

      if (item.type === 'directory') {
        await this.moveDirectory(sessionId, client, childSourcePath, childTargetPath)
      } else {
        const fullChildSourcePath = this.getFullPath(childSourcePath)
        const fullChildTargetPath = this.getFullPath(childTargetPath)
        await client.move(fullChildSourcePath, fullChildTargetPath, { overwrite: true })
      }
    }

    await client.deleteDirectory(fullSourcePath)
  }

  private async copyDirectory(
    sessionId: string,
    client: any,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    const fullSourcePath = this.getFullPath(sourcePath)
    const fullTargetPath = this.getFullPath(targetPath)

    await client.createDirectory(fullTargetPath, { recursive: true })
    const list = await client.getDirectoryContents(fullSourcePath)

    for (const item of list) {
      const itemName = path.basename(item.filename)
      const childSourcePath = this.joinPaths(sourcePath, itemName)
      const childTargetPath = this.joinPaths(targetPath, itemName)

      if (item.type === 'directory') {
        await this.copyDirectory(sessionId, client, childSourcePath, childTargetPath)
      } else {
        const fullChildSourcePath = this.getFullPath(childSourcePath)
        const fullChildTargetPath = this.getFullPath(childTargetPath)
        await client.copyFile(fullChildSourcePath, fullChildTargetPath, { overwrite: true })
      }
    }
  }
}

export default WebdavProtocol
