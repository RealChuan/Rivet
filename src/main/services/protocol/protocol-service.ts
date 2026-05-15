import { ProtocolFactory } from './factory.js'
import { sessionManager } from '../session-manager.js'
import { type ConnectionConfig, type FileInfo } from '@shared/types/index.js'
import { SftpStatus } from '@shared/constants/index.js'
import { logger } from '../../utils/index.js'

export class ProtocolService {
  static async connect(config: ConnectionConfig) {
    const protocol = ProtocolFactory.getProtocol(config.protocol)
    const result = await protocol.connect(config)

    if (result.statusCode === SftpStatus.HOST_KEY_MISMATCH) {
      return result
    }

    if (!result.sessionId) {
      throw new Error('Connection failed: no session ID returned')
    }

    logger.info(`Connection established: ${config.name} (${config.connectionUuid})`)
    return result
  }

  static async disconnect(sessionId: string) {
    const protocol = this.getProtocolBySessionId(sessionId)
    await protocol.disconnect(sessionId)
    logger.info(`Disconnected: ${sessionId}`)
  }

  static async list(sessionId: string, remotePath: string): Promise<FileInfo[]> {
    const protocol = this.getProtocolBySessionId(sessionId)
    return await protocol.list(sessionId, remotePath)
  }

  static async mkdir(sessionId: string, remotePath: string): Promise<void> {
    const protocol = this.getProtocolBySessionId(sessionId)
    await protocol.mkdir(sessionId, remotePath)
  }

  static async rename(sessionId: string, file: FileInfo, newName: string): Promise<void> {
    const protocol = this.getProtocolBySessionId(sessionId)
    await protocol.rename(sessionId, file, newName)
  }

  static async delete(sessionId: string, file: FileInfo): Promise<void> {
    const protocol = this.getProtocolBySessionId(sessionId)
    await protocol.delete(sessionId, file)
  }

  static async copy(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const protocol = this.getProtocolBySessionId(sessionId)
    await protocol.copy(sessionId, file, targetPath)
  }

  static async move(sessionId: string, file: FileInfo, targetPath: string): Promise<void> {
    const protocol = this.getProtocolBySessionId(sessionId)
    await protocol.move(sessionId, file, targetPath)
  }

  private static getProtocolBySessionId(sessionId: string) {
    const handle = sessionManager.get(sessionId)
    if (!handle) {
      throw new Error(`Connection not found: ${sessionId}`)
    }
    return ProtocolFactory.getProtocol(handle.protocolType)
  }
}

export default ProtocolService
