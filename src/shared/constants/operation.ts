export const FILE_OPERATIONS = {
  COPY: 'copy',
  MOVE: 'move',
  DELETE: 'delete',
  RENAME: 'rename',
} as const

export type FileOperationType = (typeof FILE_OPERATIONS)[keyof typeof FILE_OPERATIONS]
