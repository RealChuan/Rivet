import { type FileProtocol } from './base.js'
import { SftpProtocol } from './sftp.js'
import { WebdavProtocol } from './webdav.js'

export class ProtocolFactory {
  static getProtocol(protocol: 'sftp' | 'webdav'): FileProtocol {
    if (protocol === 'sftp') {
      return new SftpProtocol()
    }
    return new WebdavProtocol()
  }
}

export default ProtocolFactory
