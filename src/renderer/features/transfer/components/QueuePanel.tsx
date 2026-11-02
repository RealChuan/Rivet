import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { TransferTask } from '@shared/types/transfer.js'
import {
  QUEUE_PANEL_MODE,
  OPERATION_STATUS,
  TRANSFER_DIRECTION,
  TRANSFER_SCOPE,
} from '@shared/constants/transfer.js'
import { useUiStore } from '../../../stores/ui.js'
import { useConnectionStore } from '../../session/stores/connection.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useTransferActions } from '../hooks/use-transfer-actions.js'
import { useTransferSort } from '../hooks/use-transfer-sort.js'
import { useTransferStore } from '../stores/transfer.js'
import { QueuePanelHeader } from './QueuePanelHeader.js'
import { TransferList } from './TransferList.js'

const isActiveTask = (task: TransferTask): boolean =>
  task.status === OPERATION_STATUS.RUNNING || task.status === OPERATION_STATUS.WAITING

export const QueuePanel = () => {
  const { t } = useTranslation()
  const mode = useUiStore((state) => state.queuePanelMode)
  const tasks = useTransferStore((state) => state.tasks)
  const scope = useTransferStore((state) => state.scope)
  const setScope = useTransferStore((state) => state.setScope)
  const activeTab = useTransferStore((state) => state.activeTab)
  const setActiveTab = useTransferStore((state) => state.setActiveTab)
  const activeSessionId = useSessionStore((state) => state.activeSessionId)
  const sessions = useSessionStore((state) => state.sessions)
  const connections = useConnectionStore((state) => state.connections)
  const { cancelAll } = useTransferActions()

  const scopedTasks = useMemo(
    () =>
      tasks.filter((task) => scope === TRANSFER_SCOPE.ALL || task.sessionId === activeSessionId),
    [tasks, scope, activeSessionId],
  )

  const visibleTasks = useMemo(
    () => scopedTasks.filter((task) => task.direction === activeTab),
    [scopedTasks, activeTab],
  )

  const uploadCount = useMemo(
    () => scopedTasks.filter((task) => task.direction === TRANSFER_DIRECTION.UPLOAD).length,
    [scopedTasks],
  )
  const downloadCount = scopedTasks.length - uploadCount
  const hasActiveTasks = useMemo(() => scopedTasks.some(isActiveTask), [scopedTasks])

  const { sortBy, sortOrder, setSort, sortedTasks } = useTransferSort(visibleTasks)

  const resolveSessionName = useCallback(
    (sessionId: string) => {
      const session = sessions.find((item) => item.sessionId === sessionId)
      const connection = session
        ? connections.find((item) => item.id === session.connectionId)
        : undefined
      return connection?.name ?? t(($) => $.transfer.queue.unknownConnection)
    },
    [sessions, connections, t],
  )

  // 别的连接有任务而当前没有：提示切到全部。
  const otherScopeHasTasks = useMemo(
    () => scope === TRANSFER_SCOPE.CURRENT && scopedTasks.length === 0 && tasks.length > 0,
    [tasks, scopedTasks, scope],
  )

  const handleCancelAll = () => {
    void cancelAll(scope === TRANSFER_SCOPE.ALL ? undefined : (activeSessionId ?? undefined))
  }

  const isCollapsed = mode === QUEUE_PANEL_MODE.COLLAPSED

  return (
    <div className="flex flex-col h-full min-h-0 bg-bg" data-testid="queue-panel">
      <QueuePanelHeader
        mode={mode}
        summaryTasks={tasks}
        uploadCount={uploadCount}
        downloadCount={downloadCount}
        activeTab={activeTab}
        scope={scope}
        sortBy={sortBy}
        sortOrder={sortOrder}
        hasActiveTasks={hasActiveTasks}
        onTabChange={setActiveTab}
        onScopeChange={setScope}
        onSort={setSort}
        onCancelAll={handleCancelAll}
      />

      {!isCollapsed &&
        (visibleTasks.length === 0 ? (
          <div className="flex-1 flex items-center justify-center gap-1.5 px-4 text-xs text-text-muted">
            <span>
              {otherScopeHasTasks
                ? t(($) => $.transfer.queue.emptyCurrentScope)
                : t(($) => $.transfer.queue.empty)}
            </span>
            {otherScopeHasTasks && (
              <button
                type="button"
                onClick={() => setScope(TRANSFER_SCOPE.ALL)}
                className="text-accent bg-transparent border-none p-0 cursor-pointer hover:underline focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              >
                {t(($) => $.transfer.queue.viewAll)}
              </button>
            )}
          </div>
        ) : (
          <TransferList
            tasks={sortedTasks}
            grouped={scope === TRANSFER_SCOPE.ALL}
            resolveSessionName={resolveSessionName}
          />
        ))}
    </div>
  )
}
