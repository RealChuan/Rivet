export interface FileInfo {
  name: string
  type: 'file' | 'directory'
  size: number
  modifyTime: number
  permissions?: string
  owner?: string
  absolutePath: string
}
