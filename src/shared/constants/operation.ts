/**
 * 文件操作类型常量
 */
export const FileOperation = {
  /** 复制操作 */
  COPY: 'copy',
  /** 移动操作 */
  MOVE: 'move',
  /** 删除操作 */
  DELETE: 'delete',
  /** 重命名操作 */
  RENAME: 'rename',
} as const

/**
 * 文件操作类型联合类型
 */
export type FileOperationType = (typeof FileOperation)[keyof typeof FileOperation]
