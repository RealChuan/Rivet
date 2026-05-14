import { type FileProtocol } from './base.js'
import { SftpProtocol } from './sftp.js'
import { WebdavProtocol } from './webdav.js'
import { ProtocolType } from '@shared/constants/index.js'
import type { ProtocolType as ProtocolTypeEnum } from '@shared/types/index.js'

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
