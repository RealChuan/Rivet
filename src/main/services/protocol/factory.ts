import { type FileProtocol } from './base.js'
import { SftpProtocol } from './sftp.js'
import { WebdavProtocol } from './webdav.js'

export class ProtocolFactory {
  private static sftpProtocol = new SftpProtocol()
  private static webdavProtocol = new WebdavProtocol()

  static getProtocol(protocol: 'sftp' | 'webdav'): FileProtocol {
    if (protocol === 'sftp') {
      return this.sftpProtocol
    }
    return this.webdavProtocol
  }
}

export default ProtocolFactory
