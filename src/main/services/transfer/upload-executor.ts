import fs from 'node:fs'
import type { TransferTask, UploadOperation } from '@shared/types/index.js'
import { logger } from '@main/utils/index.js'
import {
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
  TRANSFER_DIRECTION,
} from '@shared/constants/index.js'
import { isErr } from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import type {
  DirectoryExpanderEntry,
  DirectoryExpanderStrategy,
  TransferContext,
} from './transfer-context.js'
import { protocolService } from '../protocol/protocol-service.js'
import { expandDirectory, isAbortError } from './transfer-context.js'

const uploadExpanderStrategy: DirectoryExpanderStrategy = {
  mkdirIncludesLocalPath: false,
  fileOperationType: TRANSFER_OPERATION_TYPE.UPLOAD,

  async listEntries(_task, localDir, _remoteDir) {
    let dirents: fs.Dirent[]
    try {
      dirents = await fs.promises.readdir(localDir, { withFileTypes: true })
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to read directory: ${localDir}`, { errorMessage: rawMessage })
      return { ok: false, errorMessage: `Failed to read directory: ${rawMessage}` }
    }
    const entries: DirectoryExpanderEntry[] = dirents.map((dirent) => ({
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
      isFile: dirent.isFile(),
      size: 0,
    }))
    return { ok: true, entries }
  },

  async resolveFileSize(_entry, localPath) {
    try {
      const stat = await fs.promises.stat(localPath)
      return stat.size
    } catch (err) {
      logger.debug('Failed to stat file for size detection', {
        childLocalPath: localPath,
        error: formatErrorMessage(err),
      })
      return 0
    }
  },
}

export async function executeUploadFolderOp(
  ctx: TransferContext,
  op: UploadOperation,
  task: TransferTask | undefined,
): Promise<void> {
  if (op.type === TRANSFER_OPERATION_TYPE.MKDIR) {
    const sessionId = task?.sessionId ?? ''
    const result = await protocolService.mkdir(sessionId, op.remotePath)

    if (ctx.isTaskCancelled(op.parentTaskId)) return

    if (!result.success) {
      ctx.failOperation(op, result.error?.message ?? 'Mkdir failed')
      return
    }

    op.status = OPERATION_STATUS.COMPLETED

    if (task) {
      if (task.direction === TRANSFER_DIRECTION.DOWNLOAD) return
      await expandDirectory(ctx, task, op.remotePath, uploadExpanderStrategy)
    }
  } else if (op.type === TRANSFER_OPERATION_TYPE.UPLOAD) {
    const controller = new AbortController()
    ctx.abortControllers.set(op.id, controller)

    try {
      const sessionId = task?.sessionId ?? ''
      const result = await protocolService.upload(
        sessionId,
        op.localPath ?? '',
        op.remotePath,
        (transferred) => {
          if (task) ctx.onOperationProgress(op, task, transferred)
        },
        controller.signal,
      )

      if (ctx.isTaskCancelled(op.parentTaskId)) return

      if (isErr(result)) {
        if (isAbortError(result.error)) {
          ctx.removeOperation(op.id, op.parentTaskId)
        } else {
          ctx.failOperation(op, result.error.message)
          return
        }
      } else {
        op.status = OPERATION_STATUS.COMPLETED
        op.transferredSize = op.fileSize ?? 0
      }
    } finally {
      ctx.abortControllers.delete(op.id)
    }
  }
}
