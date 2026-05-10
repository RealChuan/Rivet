import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQueueStore } from '../../stores/queueStore.js'
import { useSessionStore } from '../../stores/sessionStore.js'
import { useTransferQueue } from '../../hooks/useTransferQueue.js'
import { TransferTask } from '../../../shared/types.js'

interface TaskItemProps {
  task: TransferTask
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { t } = useTranslation()
  const { removeTask } = useQueueStore()
  const { cancelTask, retryTask } = useTransferQueue()
  const { sessions } = useSessionStore()

  const session = sessions.find(s => s.id === task.connectionId)
  const sessionName = session?.config.name || session?.config.host || task.connectionId

  const getFileName = (path: string): string => {
    return path.split(/[/\\]/).pop() || path
  }

  const statusConfig = {
    pending: {
      bg: 'rgba(219, 187, 20, 0.15)',
      color: '#dcbb14',
      label: t('queue.pending'),
    },
    active: {
      bg: 'rgba(59, 130, 246, 0.15)',
      color: '#3b82f6',
      label: t('queue.active'),
    },
    completed: {
      bg: 'rgba(78, 201, 176, 0.15)',
      color: '#4ec9b0',
      label: t('queue.completed'),
    },
    failed: {
      bg: 'rgba(241, 76, 76, 0.15)',
      color: '#f14c4c',
      label: t('queue.failed'),
    },
  }[task.status]

  return (
    <div className="mx-3 my-1.5 p-3 rounded-lg bg-hover border border-border">
      <div className="flex items-start gap-2.5">
        <div
          className="w-8 h-8 rounded flex items-center justify-center shrink-0"
          style={{ backgroundColor: statusConfig.bg }}
        >
          {task.type === 'upload' ? (
            <svg
              className="w-3.5 h-3.5 stroke-2"
              viewBox="0 0 24 24"
              fill="none"
              style={{ stroke: statusConfig.color }}
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          ) : (
            <svg
              className="w-3.5 h-3.5 stroke-2"
              viewBox="0 0 24 24"
              fill="none"
              style={{ stroke: statusConfig.color }}
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              {task.type === 'upload' ? t('queue.upload') : t('queue.download')}
            </span>
            <span
              className="text-xs font-semibold px-1.5 py-0.5 rounded-full"
              style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
            >
              {statusConfig.label}
            </span>
          </div>
          <div
            className="text-sm text-text truncate"
            title={task.type === 'upload' ? task.localPath : task.remotePath}
          >
            {getFileName(task.type === 'upload' ? task.localPath : task.remotePath)}
          </div>
          <div
            className="text-xs text-text-muted mt-0.5 truncate"
            title={`${session?.config.protocol?.toUpperCase()}://${session?.config.host}:${session?.config.port}`}
          >
            {session?.config.protocol?.toUpperCase()} {sessionName}
          </div>
          {task.status === 'active' && (
            <div className="mt-2">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex-1 h-1 bg-border rounded overflow-hidden">
                  <div
                    className="h-full rounded transition-all duration-300"
                    style={{ width: `${task.progress}%`, backgroundColor: statusConfig.color }}
                  />
                </div>
                <span
                  className="text-xs font-semibold w-8 text-right"
                  style={{ color: statusConfig.color }}
                >
                  {task.progress}%
                </span>
              </div>
            </div>
          )}
          {task.error && (
            <div className="flex items-center gap-1 mt-1.5 text-xs text-danger">
              <svg className="w-3 h-3 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="truncate" title={task.error}>
                {task.error}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-60">
          {task.status === 'active' && (
            <button
              onClick={() => cancelTask(task.id)}
              className={`
                p-1 rounded bg-transparent border-none
                cursor-pointer text-danger
                hover:bg-[rgba(241,76,76,0.1)] transition-colors
              `}
              title={t('queue.cancel')}
            >
              <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {task.status === 'failed' && (
            <button
              onClick={() => retryTask(task)}
              className={`
                p-1 rounded bg-transparent border-none
                cursor-pointer text-accent
                hover:bg-hover transition-colors
              `}
              title={t('queue.retry')}
            >
              <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
          {(task.status === 'completed' || task.status === 'failed') && (
            <button
              onClick={() => removeTask(task.id)}
              className={`
                p-1 rounded bg-transparent border-none
                cursor-pointer text-text-muted
                hover:bg-hover transition-colors
              `}
              title={t('queue.clear')}
            >
              <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TaskItem
