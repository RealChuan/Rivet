import type { Entry } from '@shared/domain/entry.js'
import type { FileInfo } from '@shared/types/index.js'
import { FILE_TYPE } from '@shared/constants/ui.js'

/** 协议层 `Entry` → 既有 IPC 边界 `FileInfo`。 */
export function toFileInfo(entry: Entry): FileInfo {
  return {
    name: entry.name,
    type: entry.kind === 'directory' ? FILE_TYPE.DIRECTORY : FILE_TYPE.FILE,
    size: entry.size,
    modifyTime: entry.mtime,
    permissions: entry.permissions ?? '',
    owner: entry.owner ?? '',
    absolutePath: entry.path,
  }
}
