/**
 * 协议层统一条目。`path` 是远端绝对路径，`mtime` 是毫秒时间戳。
 * IPC 边界会把它映射回既有的 `FileInfo`（见 main/protocol/entry-mapper）。
 */
export type EntryKind = 'file' | 'directory' | 'symlink'

export interface Entry {
  readonly name: string
  readonly kind: EntryKind
  readonly size: number
  readonly mtime: number
  readonly permissions?: string
  /** 权限位原值（含 setuid/setgid/sticky），供权限编辑器回填与保留特殊位 */
  readonly mode?: number
  readonly owner?: string
  readonly path: string
  /**
   * 协议层能给出比「名字以 `.` 开头」更准的判定时填它（如 SMB 的隐藏属性）；
   * 留空则由 entry-mapper 按点号规则兜底。
   */
  readonly isHidden?: boolean
}

/**
 * 能力快照在 connect 时确定、会话期间不可变。
 * 缺少的能力在 UI 上隐藏，不做运行中降级。
 */
export interface Capabilities {
  readonly chmod: boolean
  readonly symlink: boolean
  readonly serverSideCopy: boolean
  readonly serverSideMove: boolean
  readonly atomicRename: boolean
  readonly dirIsEntity: boolean
  readonly caseSensitive: boolean
}

export const PROVIDER_KIND = {
  SFTP: 'sftp',
  SMB: 'smb',
  WEBDAV: 'webdav',
  S3: 's3',
} as const

export type ProviderKind = (typeof PROVIDER_KIND)[keyof typeof PROVIDER_KIND]
