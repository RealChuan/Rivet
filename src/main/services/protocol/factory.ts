import { type FileProtocol } from './base.js'
import { SftpProtocol } from './sftp.js'
import { WebdavProtocol } from './webdav.js'
import { ProtocolType } from '@shared/constants/index.js'
import type { ProtocolType as ProtocolTypeEnum } from '@shared/types/index.js'

/**
 * ProtocolFactory - 协议实例工厂（单例模式）
 *
 * 设计说明：
 * 1. 协议实例（SftpProtocol、WebdavProtocol）是无状态的，不持有任何连接状态
 * 2. 所有连接状态由 sessionManager 统一管理，通过 sessionId 进行关联
 * 3. 使用单例模式避免创建重复的无状态实例，提高资源利用率
 * 4. 在 Node.js 单线程环境下，静态 Map 的操作是原子的，无需额外同步
 *
 * 注意：如果未来扩展到 Worker 线程或多进程模式，需要重新评估此设计
 */
export class ProtocolFactory {
  private static instances = new Map<ProtocolTypeEnum, FileProtocol>()

  static getProtocol(protocol: ProtocolTypeEnum): FileProtocol {
    if (!this.instances.has(protocol)) {
      const instance = protocol === ProtocolType.SFTP ? new SftpProtocol() : new WebdavProtocol()
      this.instances.set(protocol, instance)
    }
    return this.instances.get(protocol)!
  }
}

export default ProtocolFactory
