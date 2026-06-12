import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OPERATION_STATUS } from '@shared/constants/transfer.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'

/**
 * 活跃传输任务守卫 hook
 *
 * 统一处理"有活跃任务时弹出确认框"的逻辑，适用于：
 * - 关闭窗口（全局检查）
 * - 断开连接（按 sessionId 检查）
 *
 * 使用 getState() 读取 tasks，避免订阅整个数组导致不必要的重渲染。
 * hasActiveTasks 是命令式调用（用户点击时），不需要响应式订阅。
 */
export function useActiveTaskGuard() {
  const { t } = useTranslation()
  const runningTaskCount = useTransferStore(state => state.runningTaskCount)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [pendingSessionId, setPendingSessionId] = useState<string | undefined>(undefined)

  const hasActiveTasks = (sessionId?: string): boolean => {
    const { tasks } = useTransferStore.getState()
    if (sessionId) {
      return tasks.some(
        t =>
          t.sessionId === sessionId &&
          (t.status === OPERATION_STATUS.RUNNING || t.status === OPERATION_STATUS.WAITING)
      )
    }
    return runningTaskCount > 0
  }

  /**
   * 守卫函数：检查活跃任务，有则弹窗，无则直接执行
   * @param action 无活跃任务（或用户确认后）要执行的操作
   * @param sessionId 可选，按会话检查；不传则检查全部
   */
  const guard = (action: () => void, sessionId?: string) => {
    if (hasActiveTasks(sessionId)) {
      setPendingAction(() => action)
      setPendingSessionId(sessionId)
      setConfirmOpen(true)
    } else {
      action()
    }
  }

  const handleConfirm = async () => {
    if (!pendingAction) return
    await window.electronAPI.transfer.cancelAll(pendingSessionId)
    pendingAction()
    setConfirmOpen(false)
    setPendingAction(null)
    setPendingSessionId(undefined)
  }

  const handleCancel = () => {
    setConfirmOpen(false)
    setPendingAction(null)
    setPendingSessionId(undefined)
  }

  const isQuit = !pendingSessionId

  return {
    guard,
    hasActiveTasks,
    confirmOpen,
    handleConfirm,
    handleCancel,
    title: t(isQuit ? 'transfer.confirmQuit.title' : 'transfer.confirmDisconnect.title'),
    message: t(isQuit ? 'transfer.confirmQuit.message' : 'transfer.confirmDisconnect.message'),
  }
}
