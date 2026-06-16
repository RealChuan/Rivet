import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { TransferTask, UploadOperation } from '@shared/types/index.js'
import { logger } from '@main/utils/index.js'
import {
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
  TRANSFER_DIRECTION,
} from '@shared/constants/index.js'
import { isErr } from '@shared/types/index.js'
import { joinPaths, formatErrorMessage } from '@shared/utils/index.js'
import type { TransferContext } from './transfer-context.js'
import { protocolService } from '../protocol/protocol-service.js'
import { isAbortError } from './transfer-context.js'

async function expandUploadDirectory(
  ctx: TransferContext,
  task: TransferTask,
  remoteDir: string
): Promise<void> {
  if (ctx.isTaskCancelled(task.id)) return
  if (task.direction === TRANSFER_DIRECTION.DOWNLOAD) return

  const relativePath = path.posix.relative(task.remotePath, remoteDir)
  const localDir = relativePath === '' ? task.localPath : path.join(task.localPath, relativePath)

  let entries: fs.Dirent[]
  try {
    entries = await fs.promises.readdir(localDir, { withFileTypes: true })
  } catch (_error) {
    const errorMessage = _error instanceof Error ? _error.message : String(_error)
    logger.error(`Failed to read directory: ${localDir}`, { errorMessage })
    ctx.failTaskAndCleanup(task, `Failed to read directory: ${errorMessage}`)
    return
  }

  for (const entry of entries) {
    const childRemotePath = joinPaths(remoteDir, entry.name)
    const childLocalPath = path.join(localDir, entry.name)

    if (entry.isDirectory()) {
      ctx.addOperation({
        id: crypto.randomUUID(),
        parentTaskId: task.id,
        type: TRANSFER_OPERATION_TYPE.MKDIR,
        remotePath: childRemotePath,
        itemName: entry.name,
        status: OPERATION_STATUS.WAITING,
        transferredSize: 0,
      })
    } else if (entry.isFile()) {
      let fileSize = 0
      try {
        const stat = await fs.promises.stat(childLocalPath)
        fileSize = stat.size
      } catch (err) {
        logger.debug('Failed to stat file for size detection', {
          childLocalPath,
          error: formatErrorMessage(err),
        })
      }

      task.totalFileCount = (task.totalFileCount ?? 0) + 1

      ctx.addOperation({
        id: crypto.randomUUID(),
        parentTaskId: task.id,
        type: TRANSFER_OPERATION_TYPE.UPLOAD,
        localPath: childLocalPath,
        remotePath: childRemotePath,
        itemName: entry.name,
        status: OPERATION_STATUS.WAITING,
        fileSize,
        transferredSize: 0,
      })
    }
  }

  ctx.updateTaskStats(task)
  ctx.scheduleFolderOps(task.id)
  ctx.throttledSendProgress(task)
}

export async function executeUploadFolderOp(
  ctx: TransferContext,
  op: UploadOperation,
  task: TransferTask | undefined
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
      await expandUploadDirectory(ctx, task, op.remotePath)
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
        transferred => {
          if (task) ctx.onOperationProgress(op, task, transferred)
        },
        controller.signal
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
