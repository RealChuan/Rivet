import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConflictAction } from '@shared/constants/transfer.js'
import type { FileType } from '@shared/constants/ui.js'
import { useUiStore } from '@renderer/stores/index.js'
import logger from '@renderer/utils/logger.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { SIDEBAR_VIEW, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import { useTransferStore } from '../stores/transfer.js'
import {
  resolveConflictsAndBuildTasks,
  resolveMixedConflicts,
} from '../utils/transfer-conflict-resolver.js'
import {
  buildDownloadTask,
  buildTransferTask,
  fetchRemoteFiles,
} from '../utils/transfer-task-builder.js'

interface UseTransferActionsReturn {
  startUpload: (
    localPaths: string[],
    sessionId: string,
    remoteDir: string,
    itemType?: FileType
  ) => Promise<void>
  startMixedUpload: (
    filePaths: string[],
    folderPaths: string[],
    sessionId: string,
    remoteDir: string
  ) => Promise<void>
  startDownload: (
    remoteItems: { path: string; name: string; type: FileType; size: number }[],
    sessionId: string,
    localDir: string,
    itemType?: FileType
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
  const setActiveTab = useTransferStore(state => state.setActiveTab)

  const startMixedUpload = useCallback(
    async (filePaths: string[], folderPaths: string[], sessionId: string, remoteDir: string) => {
      if (filePaths.length === 0 && folderPaths.length === 0) return

      try {
        const remoteFiles = await fetchRemoteFiles(sessionId, remoteDir)

        const result = await resolveMixedConflicts({
          filePaths,
          folderPaths,
          remoteFiles,
          remoteDir,
        })

        if (!result) return

        const tasks = [
          ...result.resolvedFilePaths.map(p =>
            buildTransferTask(
              p.localPath,
              sessionId,
              remoteDir,
              FILE_TYPE.FILE,
              p.conflictAction,
              p.renamedName
            )
          ),
          ...result.resolvedFolderPaths.map(p =>
            buildTransferTask(
              p.localPath,
              sessionId,
              remoteDir,
              FILE_TYPE.DIRECTORY,
              p.conflictAction,
              p.renamedName
            )
          ),
        ]

        const addResult = await window.electronAPI.transfer.add(tasks)

        if (addResult.duplicates.length > 0) {
          addToast({
            type: TOAST_TYPE.WARNING,
            message: t('toast.uploadDuplicates', { count: addResult.duplicates.length }),
          })
        }

        setActiveTab(TRANSFER_DIRECTION.UPLOAD)
        setActiveView(SIDEBAR_VIEW.TRANSFERS)
      } catch (error) {
        logger.catch(error, { action: 'startMixedUpload' })
        addToast({
          type: TOAST_TYPE.ERROR,
          message: `${t('toast.uploadFailed')}: ${error instanceof Error ? error.message : String(error)}`,
        })
      }
    },
    [addToast, setActiveTab, setActiveView, t]
  )

  const startUpload = useCallback(
    async (
      localPaths: string[],
      sessionId: string,
      remoteDir: string,
      itemType: FileType = FILE_TYPE.FILE
    ) => {
      const filePaths = itemType === FILE_TYPE.FILE ? localPaths : []
      const folderPaths = itemType === FILE_TYPE.DIRECTORY ? localPaths : []
      return startMixedUpload(filePaths, folderPaths, sessionId, remoteDir)
    },
    [startMixedUpload]
  )

  const startDownload = async (
    remoteItems: { path: string; name: string; type: FileType; size: number }[],
    sessionId: string,
    localDir: string,
    itemType: FileType = FILE_TYPE.FILE
  ) => {
    if (remoteItems.length === 0) return

    try {
      const remotePaths = remoteItems.map(item => item.path)
      const localFiles = await window.electronAPI.transfer.checkLocalFiles(localDir)

      const resolvedPaths = await resolveConflictsAndBuildTasks({
        localPaths: remotePaths,
        remoteFiles: localFiles,
        remoteDir: localDir,
        itemType,
      })

      if (!resolvedPaths) return

      const sizeMap = new Map(remoteItems.map(item => [item.path, item.size]))

      const resolvedItems: {
        path: string
        size: number
        conflictAction?: ConflictAction
        renamedName?: string
      }[] = resolvedPaths.map(r => ({
        path: r.localPath,
        size: sizeMap.get(r.localPath) ?? 0,
        ...(r.conflictAction ? { conflictAction: r.conflictAction } : {}),
        ...(r.renamedName ? { renamedName: r.renamedName } : {}),
      }))

      const tasks = resolvedItems.map(item =>
        buildDownloadTask(
          item.path,
          sessionId,
          localDir,
          itemType,
          item.size,
          item.conflictAction,
          item.renamedName
        )
      )

      const result = await window.electronAPI.transfer.add(tasks)

      if (result.duplicates.length > 0) {
        addToast({
          type: TOAST_TYPE.WARNING,
          message: t('toast.downloadDuplicates', { count: result.duplicates.length }),
        })
      }

      setActiveTab(TRANSFER_DIRECTION.DOWNLOAD)
      setActiveView(SIDEBAR_VIEW.TRANSFERS)
    } catch (error) {
      logger.catch(error, { action: 'startDownload' })
      addToast({
        type: TOAST_TYPE.ERROR,
        message: `${t('toast.downloadFailed')}: ${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  const cancelTask = async (taskId: string) => {
    await window.electronAPI.transfer.cancel(taskId)
  }

  const cancelAll = async (sessionId?: string) => {
    await window.electronAPI.transfer.cancelAll(sessionId)
  }

  const retryTask = async (taskId: string) => {
    await window.electronAPI.transfer.retry(taskId)
  }

  const retryAll = async (sessionId?: string) => {
    await window.electronAPI.transfer.retryAll(sessionId)
  }

  return {
    startUpload,
    startMixedUpload,
    startDownload,
    cancelTask,
    cancelAll,
    retryTask,
    retryAll,
  }
}
