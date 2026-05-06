import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { OPERATION_STATUS } from '@shared/constants/transfer.js'
import { appApi } from '../api/app.js'
import { transferApi } from '../api/transfer.js'
import { selectRunningTaskCount, useTransferStore } from '../features/transfer/stores/transfer.js'
import logger from '../utils/logger.js'

type CloseReason = 'close' | 'quit'

/**
 * 关闭/断开连接前的活跃任务守卫。
 *
 * 关闭意图由主进程发起（`app.closeRequested`），渲染层只负责取消任务并确认；
 * 断开连接仍由渲染层 `guard` 按 sessionId 检查。
 */
export function useActiveTaskGuard() {
  const { t } = useTranslation()
  const runningTaskCount = useTransferStore(selectRunningTaskCount)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [pendingSessionId, setPendingSessionId] = useState<string | undefined>(undefined)
  const [pendingReason, setPendingReason] = useState<CloseReason | null>(null)

  const hasActiveTasks = useCallback(
    (sessionId?: string): boolean => {
      const { tasks } = useTransferStore.getState()
      if (sessionId) {
        return tasks.some(
          (t) =>
            t.sessionId === sessionId &&
            (t.status === OPERATION_STATUS.RUNNING || t.status === OPERATION_STATUS.WAITING),
        )
      }
      return runningTaskCount > 0
    },
    [runningTaskCount],
  )

  /**
   * 守卫函数：检查活跃任务，有则弹窗，无则直接执行。
   * 只用于断开连接；窗口关闭由主进程事件驱动。
   */
  const guard = useCallback(
    (action: () => void, sessionId?: string) => {
      if (hasActiveTasks(sessionId)) {
        setPendingReason(null)
        setPendingAction(() => action)
        setPendingSessionId(sessionId)
        setConfirmOpen(true)
      } else {
        action()
      }
    },
    [hasActiveTasks],
  )

  useEffect(() => {
    const unsubscribe = appApi.onCloseRequested(({ reason }) => {
      setPendingReason(reason)
      setPendingAction(null)
      setPendingSessionId(undefined)
      setConfirmOpen(true)
    })
    return unsubscribe
  }, [])

  const handleConfirm = async () => {
    try {
      await transferApi.cancelAll(pendingSessionId)
      if (pendingReason) {
        await appApi.confirmClose()
      } else {
        pendingAction?.()
      }
    } catch (error) {
      logger.catch(error, { action: 'useActiveTaskGuard.handleConfirm' })
    } finally {
      setConfirmOpen(false)
      setPendingAction(null)
      setPendingSessionId(undefined)
      setPendingReason(null)
    }
  }

  const handleCancel = () => {
    setConfirmOpen(false)
    setPendingAction(null)
    setPendingSessionId(undefined)
    setPendingReason(null)
  }

  const isQuit = pendingReason === 'quit'
  const isClose = pendingReason === 'close'

  return {
    guard,
    hasActiveTasks,
    confirmOpen,
    handleConfirm,
    handleCancel,
    pendingReason,
    title: t(($) =>
      isQuit
        ? $.transfer.confirmQuit.title
        : isClose
          ? $.transfer.confirmClose.title
          : $.transfer.confirmDisconnect.title,
    ),
    message: t(($) =>
      isQuit
        ? $.transfer.confirmQuit.message
        : isClose
          ? $.transfer.confirmClose.message
          : $.transfer.confirmDisconnect.message,
    ),
  }
}
