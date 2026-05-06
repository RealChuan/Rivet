import { useEffect, useCallback, useRef } from 'react'
import { useQueueStore } from '../stores/queueStore'
import { useSessionStore } from '../stores/sessionStore'
import { useUiStore } from '../stores/uiStore'
import { TransferTask } from '@shared/types'

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

  useEffect(() => {
    const unsubscribe = window.electronAPI.onProgress(event => {
      updateTaskProgress(event.transferId, event.percent)
    })

    return () => {
      unsubscribe()
    }
  }, [updateTaskProgress])

  const processQueue = useCallback(async () => {
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
        startTransfer(task)
      }
    } finally {
      isProcessingRef.current = false
    }
  }, [tasks])

  const startTransfer = useCallback(
    async (task: TransferTask) => {
      try {
        if (task.type === 'download') {
          const session = sessions.find(s => s.id === task.sessionId)
          if (!session) {
            failTask(task.id, 'Session not found')
            return
          }

          const result = await window.electronAPI.downloadFile(
            task.sessionId,
            task.remotePath,
            task.localPath
          )

          if (result.success) {
            completeTask(task.id)
            addToast({ type: 'success', message: `Downloaded: ${task.remotePath}` })
          }
        } else {
          const result = await window.electronAPI.uploadFile(
            task.sessionId,
            task.localPath,
            task.remotePath
          )

          if (result.success) {
            completeTask(task.id)
            addToast({ type: 'success', message: `Uploaded: ${task.localPath}` })
          }
        }
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

  const upload = useCallback(
    async (localPath: string, remotePath: string) => {
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
    async (remotePath: string, localPath: string) => {
      if (!activeSessionId) {
        addToast({ type: 'error', message: 'No active session' })
        return
      }

      const task = addTask(activeSessionId, 'download', localPath, remotePath)
      processQueue()
      return task
    },
    [activeSessionId, addTask, processQueue, addToast]
  )

  const cancelTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find(t => t.id === taskId)
      if (task && task.status === 'active') {
        await window.electronAPI.cancelTransfer(taskId)
      }
      removeTask(taskId)
    },
    [tasks, removeTask]
  )

  const retryTask = useCallback(
    (task: TransferTask) => {
      const newTask = addTask(task.sessionId, task.type, task.localPath, task.remotePath)
      processQueue()
      return newTask
    },
    [addTask, processQueue]
  )

  useEffect(() => {
    processQueue()
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
