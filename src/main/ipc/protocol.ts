import { protocolContract } from '@shared/contract/protocol.contract.js'
import { protocolService } from '../protocol/protocol-service.js'
import { registerContract } from './register.js'

export function setupProtocolIpcHandlers(): void {
  registerContract(protocolContract, {
    'protocol.connect': (config) => protocolService.connect(config),
    'protocol.disconnect': (sessionId, requestId) =>
      protocolService.disconnect(sessionId, requestId),
    'protocol.listBuckets': (request) => protocolService.listBuckets(request),
    'protocol.list': (sessionId, path, requestId, limit) =>
      protocolService.list(sessionId, path, requestId, limit),
    'protocol.stat': (sessionId, path, requestId) =>
      protocolService.stat(sessionId, path, requestId),
    'protocol.mkdir': (sessionId, path, requestId) =>
      protocolService.mkdir(sessionId, path, requestId),
    'protocol.rename': (sessionId, file, newName, requestId) =>
      protocolService.rename(sessionId, file, newName, requestId),
    'protocol.chmod': (sessionId, file, mode, requestId) =>
      protocolService.chmod(sessionId, file, mode, requestId),
    'protocol.delete': (sessionId, file, requestId) =>
      protocolService.delete(sessionId, file, requestId),
    'protocol.shareLink': (sessionId, file, expiresInSeconds) =>
      protocolService.shareLink(sessionId, file, expiresInSeconds),
    'protocol.copy': (sessionId, file, targetPath, requestId) =>
      protocolService.copy(sessionId, file, targetPath, requestId),
    'protocol.move': (sessionId, file, targetPath, requestId) =>
      protocolService.move(sessionId, file, targetPath, requestId),
    'protocol.cancel': (requestId) => {
      protocolService.cancel(requestId)
    },
    'protocol.calculateFolderStats': (sessionId, path) =>
      protocolService.calculateFolderStats(sessionId, path),
    'protocol.cancelCalculateFolderStats': (sessionId) => {
      protocolService.cancelCalculateFolderStats(sessionId)
    },
  })
}
