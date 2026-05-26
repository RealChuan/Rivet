/**
 * 主机密钥记录接口
 * 用于存储 SSH 服务器的已知主机密钥信息
 *
 * @remarks
 * 当用户首次连接到 SSH 服务器时，会提示确认主机密钥指纹
 * 确认后将密钥指纹存储在此记录中，后续连接时进行验证
 */
export interface HostKey {
  /** 关联的连接唯一标识 */
  connectionId: string

  /** 服务器主机密钥指纹（哈希值） */
  hash: string

  /** 记录创建时间戳 */
  createdAt: number

  /** 数据一致性校验和（可选） */
  checksum?: string
}
