import React from 'react'
import { useUiStore } from '@renderer/stores/uiStore.js'
import { useQueueStore } from '@renderer/features/transfer/stores/queueStore.js'
import TaskItem from './TaskItem.js'

export const QueueDrawer: React.FC = () => {
  const { queueDrawerOpen, queueDrawerWidth, setQueueDrawerOpen } = useUiStore()
  const { tasks, clearCompletedTasks } = useQueueStore()

  if (!queueDrawerOpen) return null

  const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed')

  return (
    <div
      className="h-full border-l border-border flex flex-col bg-bg animate-slideInRight"
      style={{ width: queueDrawerWidth }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 stroke-accent stroke-2" viewBox="0 0 24 24" fill="none">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h2 className="text-sm font-semibold text-text">Transfer Queue</h2>
          {activeTasks.length > 0 && (
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[rgba(59,130,246,0.15)] text-accent">
              {activeTasks.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {completedTasks.length > 0 && (
            <button
              onClick={clearCompletedTasks}
              className={`
                px-2.5 py-1 text-xs rounded
                bg-transparent border-none cursor-pointer
                text-text-muted hover:bg-hover transition-colors
              `}
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setQueueDrawerOpen(false)}
            className={`
              p-1 rounded bg-transparent border-none
              cursor-pointer text-text-muted hover:bg-hover transition-colors
            `}
          >
            <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tasks.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-6">
            <div className="w-12 h-12 rounded-full bg-hover flex items-center justify-center mb-3">
              <svg className="w-5 h-5 stroke-text-muted stroke-1.5" viewBox="0 0 24 24" fill="none">
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <p className="text-xs text-text-muted">No transfers</p>
          </div>
        ) : (
          <div className="py-2">
            {activeTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
            {completedTasks.length > 0 && (
              <>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                    Completed
                  </span>
                </div>
                {completedTasks.map(task => (
                  <TaskItem key={task.id} task={task} />
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default QueueDrawer
