import { type FileProtocol } from './base.js'
import { SftpProtocol } from './sftp.js'
import { WebdavProtocol } from './webdav.js'
import { ProtocolType } from '@shared/constants/index.js'
import type { ProtocolType as ProtocolTypeEnum } from '@shared/types/index.js'

export class ProtocolFactory {
  static getProtocol(protocol: ProtocolTypeEnum): FileProtocol {
    if (protocol === ProtocolType.SFTP) {
      return new SftpProtocol()
    }
    return new WebdavProtocol()
  }
}

export default ProtocolFactory
