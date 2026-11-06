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
    // 隐藏判定只在这里：协议能给出更准的结果就用它，否则按点号规则兜底。
    isHidden: entry.isHidden ?? entry.name.startsWith('.'),
  }
}
