import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileInfo } from '@shared/types/index.js'
import type { ConflictResolution, TransferTask } from '@shared/types/transfer.js'
import { useUiStore } from '@renderer/stores/index.js'
import logger from '@renderer/utils/logger.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import {
  SIDEBAR_VIEW,
  TRANSFER_ITEM_TYPE,
  TRANSFER_TASK_STATUS,
  type ConflictAction,
  type TransferItemType,
} from '@shared/constants/transfer.js'
import { useTransferConflictStore } from '../stores/transfer-conflict.js'
import { applyResolutions, detectConflicts, pathBasename } from './useTransferConflict.js'

const buildTransferTask = (
  localPath: string,
  sessionId: string,
  remoteDir: string,
  itemType: TransferItemType,
  conflictAction?: ConflictAction,
  renamedName?: string
): TransferTask => {
  const name = pathBasename(localPath)
  const itemName = renamedName ?? name
  const remotePath = renamedName ? `${remoteDir}/${renamedName}` : `${remoteDir}/${name}`

  return {
    id: crypto.randomUUID(),
    sessionId,
    localPath,
    remotePath,
    itemName,
    itemType,
    status: TRANSFER_TASK_STATUS.WAITING,
    ...(conflictAction !== undefined ? { conflictAction } : {}),
    ...(renamedName !== undefined ? { renamedName } : {}),
    fileSize: 0,
    transferredSize: 0,
    createdAt: Date.now(),
  }
}

interface UseTransferActionsReturn {
  startUpload: (
    localPaths: string[],
    sessionId: string,
    remoteDir: string,
    itemType?: TransferItemType
  ) => Promise<void>
  cancelTask: (taskId: string) => Promise<void>
  cancelAll: (sessionId?: string) => Promise<void>
  retryTask: (taskId: string) => Promise<void>
  retryAll: (sessionId?: string) => Promise<void>
}

export function useTransferActions(): UseTransferActionsReturn {
  const { t } = useTranslation()
  const addToast = useUiStore(state => state.addToast)
  const setActiveView = useUiStore(state => state.setActiveView)

  const startUpload = useCallback(
    async (
      localPaths: string[],
      sessionId: string,
      remoteDir: string,
      itemType: TransferItemType = TRANSFER_ITEM_TYPE.FILE
    ) => {
      if (localPaths.length === 0) return

      try {
        const response = await window.electronAPI.protocol.list(sessionId, remoteDir)
        let remoteFiles: FileInfo[] = []
        if (response.success) {
          remoteFiles = response.value
        }

        const conflicts = detectConflicts(localPaths, remoteFiles, remoteDir, itemType)

        let resolvedPaths: {
          localPath: string
          remotePath: string
          itemName: string
          conflictAction?: ConflictAction
          renamedName?: string
        }[]

        if (conflicts.length > 0) {
          const resolutions = await new Promise<ConflictResolution[] | null>(resolve => {
            useTransferConflictStore.getState().openDialog(conflicts, resolve)
          })

          useTransferConflictStore.getState().clearAll()

          if (!resolutions) return

          resolvedPaths = applyResolutions(localPaths, resolutions, remoteDir, itemType)
        } else {
          resolvedPaths = localPaths.map(p => ({
            localPath: p,
            remotePath: `${remoteDir}/${pathBasename(p)}`,
            itemName: pathBasename(p),
          }))
        }

        const tasks = resolvedPaths.map(p =>
          buildTransferTask(
            p.localPath,
            sessionId,
            remoteDir,
            itemType,
            p.conflictAction,
            p.renamedName
          )
        )

        const result = await window.electronAPI.transfer.add(tasks)

        if (result.duplicates.length > 0) {
          addToast({
            type: TOAST_TYPE.WARNING,
            message: t('toast.uploadDuplicates', { count: result.duplicates.length }),
          })
        }

        setActiveView(SIDEBAR_VIEW.TRANSFERS)
      } catch (error) {
        logger.catch(error, { action: 'startUpload' })
        addToast({
          type: TOAST_TYPE.ERROR,
          message: `${t('toast.uploadFailed')}: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
    },
    [addToast, setActiveView, t]
  )

  const cancelTask = useCallback(async (taskId: string) => {
    await window.electronAPI.transfer.cancel(taskId)
  }, [])

  const cancelAll = useCallback(async (sessionId?: string) => {
    await window.electronAPI.transfer.cancelAll(sessionId)
  }, [])

  const retryTask = useCallback(async (taskId: string) => {
    await window.electronAPI.transfer.retry(taskId)
  }, [])

  const retryAll = useCallback(async (sessionId?: string) => {
    await window.electronAPI.transfer.retryAll(sessionId)
  }, [])

  return { startUpload, cancelTask, cancelAll, retryTask, retryAll }
}
