import type { Readable, Writable } from 'node:stream'
import fs from 'node:fs'
import type { LocalFileInfo } from '@shared/types/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'

export interface LocalFsStat {
  size: number
  isDirectory: boolean
}

/** 执行器需要的最小本地文件系统面，测试可注入内存实现。 */
export interface LocalFs {
  stat(path: string): Promise<LocalFsStat>
  mkdir(path: string): Promise<void>
  readdir(path: string): Promise<LocalFileInfo[]>
  rename(from: string, to: string): Promise<void>
  rm(path: string): Promise<void>
  unlink(path: string): Promise<void>
  createReadStream(path: string): Readable
  createWriteStream(path: string): Writable
}

export const nodeLocalFs: LocalFs = {
  stat: async (path) => {
    const stat = await fs.promises.stat(path)
    return { size: stat.size, isDirectory: stat.isDirectory() }
  },

  mkdir: async (path) => {
    await fs.promises.mkdir(path, { recursive: true })
  },

  readdir: async (path) => {
    const entries = await fs.promises.readdir(path, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() || entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        size: 0,
        type: entry.isDirectory() ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE,
      }))
  },

  rename: (from, to) => fs.promises.rename(from, to),

  rm: async (path) => {
    await fs.promises.rm(path, { recursive: true, force: true })
  },

  unlink: async (path) => {
    await fs.promises.unlink(path)
  },

  createReadStream: (path) => fs.createReadStream(path),
  createWriteStream: (path) => fs.createWriteStream(path),
}
