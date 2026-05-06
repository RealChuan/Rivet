import { FileProtocol } from './BaseProtocol'
import { SftpProtocol } from './SftpProtocol'
import { WebdavProtocol } from './WebdavProtocol'

export class ProtocolFactory {
  private static sftpProtocol = new SftpProtocol()
  private static webdavProtocol = new WebdavProtocol()

  static getProtocol(protocol: 'sftp' | 'webdav'): FileProtocol {
    switch (protocol) {
      case 'sftp':
        return this.sftpProtocol
      case 'webdav':
        return this.webdavProtocol
      default:
        throw new Error(`Unknown protocol: ${protocol}`)
    }
  }
}

export default ProtocolFactory
