import { useShallow } from 'zustand/react/shallow'
import { TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { useTransferActions } from '../hooks/use-transfer-actions.js'
import { selectTasksForSessionByDirection, useTransferStore } from '../stores/transfer.js'
import { TransferList } from './TransferList.js'
import { TransferTabBar } from './TransferTabBar.js'

interface TransferAreaProps {
  sessionId: string
}

export const TransferArea = ({ sessionId }: TransferAreaProps) => {
  const activeTab = useTransferStore((state) => state.activeTab)
  const setActiveTab = useTransferStore((state) => state.setActiveTab)
  const { cancelAll } = useTransferActions()

  const uploadTasks = useTransferStore(
    useShallow((state) =>
      selectTasksForSessionByDirection(state, sessionId, TRANSFER_DIRECTION.UPLOAD),
    ),
  )
  const downloadTasks = useTransferStore(
    useShallow((state) =>
      selectTasksForSessionByDirection(state, sessionId, TRANSFER_DIRECTION.DOWNLOAD),
    ),
  )

  const handleCancelAll = () => {
    void cancelAll(sessionId)
  }

  const activeTasks = activeTab === TRANSFER_DIRECTION.UPLOAD ? uploadTasks : downloadTasks

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <TransferTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      <TransferList tasks={activeTasks} onCancelAll={handleCancelAll} />
    </div>
  )
}
