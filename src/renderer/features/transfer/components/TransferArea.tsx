import type React from 'react'
import { useTranslation } from 'react-i18next'
import { useShallow } from 'zustand/react/shallow'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { selectTasksForSessionByDirection, useTransferStore } from '../stores/transfer.js'
import { TransferList } from './TransferList.js'
import { TransferTabBar } from './TransferTabBar.js'

interface TransferAreaProps {
  sessionId: string
}

export const TransferArea: React.FC<TransferAreaProps> = ({ sessionId }) => {
  const { t } = useTranslation()
  const activeTab = useTransferStore(state => state.activeTab)
  const setActiveTab = useTransferStore(state => state.setActiveTab)
  const addToast = useUiStore(state => state.addToast)

  const uploadTasks = useTransferStore(
    useShallow(state =>
      selectTasksForSessionByDirection(state, sessionId, TRANSFER_DIRECTION.UPLOAD)
    )
  )
  const downloadTasks = useTransferStore(
    useShallow(state =>
      selectTasksForSessionByDirection(state, sessionId, TRANSFER_DIRECTION.DOWNLOAD)
    )
  )

  const handleCancelAll = () => {
    void window.electronAPI.transfer.cancelAll(sessionId).catch(() => {
      addToast({ type: TOAST_TYPE.ERROR, message: t('transfer.cancelFailed') })
    })
  }

  const activeTasks = activeTab === TRANSFER_DIRECTION.UPLOAD ? uploadTasks : downloadTasks

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TransferTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <TransferList tasks={activeTasks} onCancelAll={handleCancelAll} />
    </div>
  )
}
