import type { FileType } from '@shared/constants/ui.js'
import type { FileInfo } from '@shared/types/index.js'
import type { TransferTask } from '@shared/types/transfer.js'
import {
  OPERATION_STATUS,
  TRANSFER_DIRECTION,
  type ConflictAction,
} from '@shared/constants/transfer.js'
import { isProtocolResponseErr } from '@shared/types/index.js'
import { joinPaths, pathBasename } from '@shared/utils/index.js'

export interface ResolvedTask {
  localPath: string
  remotePath: string
  itemName: string
  conflictAction?: ConflictAction
  renamedName?: string
}

export const buildTransferTask = (
  localPath: string,
  sessionId: string,
  remoteDir: string,
  itemType: FileType,
  conflictAction?: ConflictAction,
  renamedName?: string,
): TransferTask => {
  const name = pathBasename(localPath)
  const itemName = renamedName ?? name
  const remotePath = renamedName ? joinPaths(remoteDir, renamedName) : joinPaths(remoteDir, name)

  return {
    id: crypto.randomUUID(),
    sessionId,
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath,
    remotePath,
    itemName,
    itemType,
    status: OPERATION_STATUS.WAITING,
    ...(conflictAction !== undefined ? { conflictAction } : {}),
    ...(renamedName !== undefined ? { renamedName } : {}),
    fileSize: 0,
    transferredSize: 0,
    createdAt: Date.now(),
  }
}

export const buildDownloadTask = (
  remotePath: string,
  sessionId: string,
  localDir: string,
  itemType: FileType,
  fileSize: number,
  conflictAction?: ConflictAction,
  renamedName?: string,
): TransferTask => {
  const name = pathBasename(remotePath)
  const itemName = renamedName ?? name
  const localPath = renamedName ? joinPaths(localDir, renamedName) : joinPaths(localDir, name)

  return {
    id: crypto.randomUUID(),
    sessionId,
    direction: TRANSFER_DIRECTION.DOWNLOAD,
    localPath,
    remotePath,
    itemName,
    itemType,
    status: OPERATION_STATUS.WAITING,
    localDir,
    ...(conflictAction !== undefined ? { conflictAction } : {}),
    ...(renamedName !== undefined ? { renamedName } : {}),
    fileSize,
    transferredSize: 0,
    createdAt: Date.now(),
  }
}

export async function fetchRemoteFiles(sessionId: string, remoteDir: string): Promise<FileInfo[]> {
  const response = await window.electronAPI.protocol.list(sessionId, remoteDir)
  if (!isProtocolResponseErr(response)) {
    return response.value
  }
  return []
}
