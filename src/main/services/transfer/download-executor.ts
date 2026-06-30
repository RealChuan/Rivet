import fs from 'node:fs'
import path from 'node:path'
import type { TransferTask, UploadOperation } from '@shared/types/index.js'
import { logger } from '@main/utils/index.js'
import { OPERATION_STATUS, TRANSFER_OPERATION_TYPE, ERROR_CODE } from '@shared/constants/index.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import {
  type ErrorInfo,
  type Result,
  isErr,
  ok,
  err,
  createErrorInfo,
} from '@shared/types/index.js'
import { formatErrorMessage } from '@shared/utils/index.js'
import type {
  DirectoryExpanderEntry,
  DirectoryExpanderStrategy,
  TransferContext,
} from './transfer-context.js'
import { protocolService } from '../protocol/protocol-service.js'
import { TEMP_FILE_SUFFIX, expandDirectory, isAbortError } from './transfer-context.js'

export async function executeDownloadFile(
  task: TransferTask,
  signal: AbortSignal,
  onProgress: (transferred: number) => void,
): Promise<Result<void, ErrorInfo>> {
  if (!task.localDir) {
    return err(createErrorInfo(ERROR_CODE.DOWNLOAD_ERROR, 'localDir is required for download'))
  }
  const tempLocalPath = path.join(task.localDir, task.itemName + TEMP_FILE_SUFFIX)
  const finalLocalPath = path.join(task.localDir, task.itemName)

  const result = await protocolService.download(
    task.sessionId,
    task.remotePath,
    tempLocalPath,
    onProgress,
    signal,
  )

  if (isErr(result)) {
    if (!isAbortError(result.error)) {
      await deleteLocalFile(tempLocalPath)
    }
    return result
  }

  try {
    await fs.promises.rename(tempLocalPath, finalLocalPath)
  } catch (e) {
    await deleteLocalFile(tempLocalPath)
    return err(createErrorInfo(ERROR_CODE.DOWNLOAD_ERROR, formatErrorMessage(e)))
  }

  return ok(undefined)
}

const downloadExpanderStrategy: DirectoryExpanderStrategy = {
  mkdirIncludesLocalPath: true,
  fileOperationType: TRANSFER_OPERATION_TYPE.DOWNLOAD,

  async listEntries(task, _localDir, remoteDir) {
    const listResult = await protocolService.list(task.sessionId, remoteDir)
    if (!listResult.success) {
      const errorMessage = listResult.error?.message ?? 'Failed to list remote directory'
      logger.error(`Failed to list remote directory: ${remoteDir}`, { errorMessage })
      return { ok: false, errorMessage }
    }
    const entries: DirectoryExpanderEntry[] = listResult.value.map((entry) => ({
      name: entry.name,
      isDirectory: entry.type === FILE_TYPE.DIRECTORY,
      isFile: entry.type === FILE_TYPE.FILE,
      size: entry.size,
    }))
    return { ok: true, entries }
  },

  resolveFileSize(entry) {
    return Promise.resolve(entry.size)
  },
}

export async function executeDownloadFolderOp(
  ctx: TransferContext,
  op: UploadOperation,
  task: TransferTask | undefined,
): Promise<void> {
  if (op.type === TRANSFER_OPERATION_TYPE.MKDIR) {
    // Download: create local directory
    try {
      await fs.promises.mkdir(op.localPath ?? '', { recursive: true })
    } catch (e) {
      ctx.failOperation(op, formatErrorMessage(e))
      return
    }
    op.status = OPERATION_STATUS.COMPLETED
    if (task) {
      await expandDirectory(ctx, task, op.remotePath, downloadExpanderStrategy)
    }
  } else if (op.type === TRANSFER_OPERATION_TYPE.DOWNLOAD) {
    const controller = new AbortController()
    ctx.abortControllers.set(op.id, controller)

    try {
      const sessionId = task?.sessionId ?? ''
      const tempLocalPath = (op.localPath ?? '') + TEMP_FILE_SUFFIX
      const finalLocalPath = op.localPath ?? ''

      const result = await protocolService.download(
        sessionId,
        op.remotePath,
        tempLocalPath,
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
          await deleteLocalFile(tempLocalPath)
          ctx.failOperation(op, result.error.message)
          return
        }
      } else {
        // Rename temp to final
        try {
          await fs.promises.rename(tempLocalPath, finalLocalPath)
        } catch (e) {
          await deleteLocalFile(tempLocalPath)
          ctx.failOperation(op, formatErrorMessage(e))
          return
        }
        op.status = OPERATION_STATUS.COMPLETED
        op.transferredSize = op.fileSize ?? 0
      }
    } finally {
      ctx.abortControllers.delete(op.id)
    }
  }
}

export async function deleteLocalFile(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath)
  } catch (err) {
    logger.debug('Failed to delete local file', { filePath, error: formatErrorMessage(err) })
  }
}

export async function cleanupDownloadFolder(task: TransferTask): Promise<void> {
  if (!task.localPath) return
  try {
    await fs.promises.rm(task.localPath, { recursive: true, force: true })
  } catch (err) {
    logger.debug('Failed to cleanup download folder', {
      localPath: task.localPath,
      error: formatErrorMessage(err),
    })
  }
}
