import type { FileInfo } from '@shared/types/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'

/** 远端条目进入渲染层前的最后一道净化：丢弃畸形项、清理非法文件名字符。 */
export function sanitizeFiles(files: unknown): FileInfo[] {
  if (!files || !Array.isArray(files)) {
    return []
  }
  return files
    .filter((file): file is FileInfo => {
      if (!file || typeof file !== 'object') return false
      const f = file as Record<string, unknown> // 类型守卫内中间转换，用于安全属性访问
      const size = typeof f.size === 'number' ? f.size : NaN
      return (
        typeof f.name === 'string' &&
        f.name.length > 0 &&
        (f.type === FILE_TYPE.FILE || f.type === FILE_TYPE.DIRECTORY) &&
        Number.isFinite(size) &&
        size >= 0 &&
        Number.isFinite(f.modifyTime) &&
        typeof f.absolutePath === 'string' &&
        f.absolutePath.length > 0
      )
    })
    .map((file) => ({
      name: String(file.name).replace(/[\\/:*?"<>|]/g, '_'),
      type: file.type === FILE_TYPE.DIRECTORY ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE,
      size: Number(file.size),
      modifyTime: Number(file.modifyTime),
      permissions: typeof file.permissions === 'string' ? file.permissions : '',
      owner: typeof file.owner === 'string' ? file.owner : '',
      absolutePath: String(file.absolutePath),
    }))
}
