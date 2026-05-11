import { useEffect, useCallback, useRef } from 'react'
import { useQueueStore } from '@renderer/features/transfer/stores/queueStore.js'
import { useSessionStore } from '@renderer/features/session/stores/sessionStore.js'
import { useUiStore } from '@renderer/stores/index.js'
import { type TransferTask, type FileInfo } from '@shared/types/index.js'

const MAX_CONCURRENT_TRANSFERS = 3

export function useTransferQueue() {
  const {
    tasks,
    addTask,
    updateTaskProgress,
    completeTask,
    failTask,
    removeTask,
    clearCompletedTasks,
  } = useQueueStore()
  const { sessions, activeSessionId } = useSessionStore()
  const { addToast } = useUiStore()
  const isProcessingRef = useRef(false)
  const transferIdToTaskIdRef = useRef<Map<string, string>>(new Map())

  useEffect(() => {
    const unsubscribe = window.electronAPI.protocol.onProgress(
      (event: { transferId: string; percent: number }) => {
        const taskId = transferIdToTaskIdRef.current.get(event.transferId)
        if (taskId) {
          updateTaskProgress(taskId, event.percent)
        }
      }
    )

    const currentRef = transferIdToTaskIdRef
    return () => {
      unsubscribe()
      currentRef.current.clear()
    }
  }, [updateTaskProgress])

  const startTransfer = useCallback(
    async (task: TransferTask) => {
      try {
        let result
        if (task.type === 'download') {
          const session = sessions.find(s => s.sessionId === task.sessionId)
          if (!session) {
            failTask(task.id, 'Session not found')
            return
          }

          if (!task.file) {
            failTask(task.id, 'File info is missing')
            return
          }
          result = await window.electronAPI.protocol.downloadFile(
            task.sessionId,
            task.file,
            task.localPath
          )
        } else {
          result = await window.electronAPI.protocol.uploadFile(
            task.sessionId,
            task.localPath,
            task.remotePath
          )
        }

        if (result?.transferId) {
          transferIdToTaskIdRef.current.set(result.transferId, task.id)
        }

        completeTask(task.id)
        addToast({
          type: 'success',
          message:
            task.type === 'download'
              ? `Downloaded: ${task.file ? String(task.file.name || '') : task.remotePath}`
              : `Uploaded: ${task.localPath}`,
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Transfer failed'
        failTask(task.id, errorMessage)
        addToast({
          type: 'error',
          message:
            task.type === 'download'
              ? `Download failed: ${errorMessage}`
              : `Upload failed: ${errorMessage}`,
        })
      }
    },
    [sessions, completeTask, failTask, addToast]
  )

  const processQueue = useCallback(() => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    try {
      const activeTasks = tasks.filter(t => t.status === 'active')
      const pendingTasks = tasks.filter(t => t.status === 'pending')

      if (activeTasks.length >= MAX_CONCURRENT_TRANSFERS) {
        isProcessingRef.current = false
        return
      }

      const slotsAvailable = MAX_CONCURRENT_TRANSFERS - activeTasks.length
      const tasksToStart = pendingTasks.slice(0, slotsAvailable)

      for (const task of tasksToStart) {
        void startTransfer(task)
      }
    } finally {
      isProcessingRef.current = false
    }
  }, [tasks, startTransfer])

  const upload = useCallback(
    (localPath: string, remotePath: string) => {
      if (!activeSessionId) {
        addToast({ type: 'error', message: 'No active session' })
        return
      }

      const task = addTask(activeSessionId, 'upload', localPath, remotePath)
      processQueue()
      return task
    },
    [activeSessionId, addTask, processQueue, addToast]
  )

  const download = useCallback(
    (file: FileInfo, localPath: string) => {
      if (!activeSessionId) {
        addToast({ type: 'error', message: 'No active session' })
        return
      }

      const task = addTask(activeSessionId, 'download', localPath, file.absolutePath, file)
      processQueue()
      return task
    },
    [activeSessionId, addTask, processQueue, addToast]
  )

  const cancelTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find(t => t.id === taskId)
      if (task?.status === 'active') {
        const transferId = Array.from(transferIdToTaskIdRef.current.entries()).find(
          ([, tid]) => tid === taskId
        )?.[0]
        if (transferId) {
          await window.electronAPI.protocol.cancelTransfer(transferId)
        }
      }
      removeTask(taskId)
    },
    [tasks, removeTask]
  )

  const retryTask = useCallback(
    (task: TransferTask) => {
      const newTask = addTask(task.sessionId, task.type, task.localPath, task.remotePath)
      void processQueue()
      return newTask
    },
    [addTask, processQueue]
  )

  useEffect(() => {
    void processQueue()
  }, [tasks, processQueue])

  return {
    tasks,
    upload,
    download,
    cancelTask,
    retryTask,
    clearCompletedTasks,
  }
}

export default useTransferQueue
