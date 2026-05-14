export const FileOperation = {
  COPY: 'copy',
  MOVE: 'move',
  DELETE: 'delete',
  RENAME: 'rename',
} as const

export type FileOperationType = (typeof FileOperation)[keyof typeof FileOperation]
