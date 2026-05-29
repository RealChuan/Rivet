/**
 * 文件信息接口
 * 表示远程服务器上的文件或目录的元数据
 */
import type { FileType } from '@shared/constants/ui.js'

export interface FileInfo {
  name: string
  type: FileType

  /** 文件大小（字节） */
  size: number

  /** 修改时间（Unix 时间戳，毫秒） */
  modifyTime: number

  /** 权限字符串（SFTP 协议，格式如 rwxrwxrwx） */
  permissions?: string

  /** 文件所有者（SFTP 协议） */
  owner?: string

  /** 文件的绝对路径（相对于服务器根目录） */
  absolutePath: string
}
