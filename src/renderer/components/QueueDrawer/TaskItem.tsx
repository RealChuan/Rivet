import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQueueStore } from '../../stores/queueStore'
import { useSessionStore } from '../../stores/sessionStore'
import { TransferTask } from '@shared/types'

interface TaskItemProps {
  task: TransferTask
}

export const TaskItem: React.FC<TaskItemProps> = ({ task }) => {
  const { t } = useTranslation()
  const { cancelTask, retryTask, removeTask } = useQueueStore()
  const { sessions } = useSessionStore()

  const session = sessions.find(s => s.id === task.sessionId)
  const sessionName = session?.config.name || session?.config.host || task.sessionId

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
    <div
      style={{
        margin: '6px 12px',
        padding: '12px',
        borderRadius: '8px',
        backgroundColor: 'var(--hover)',
        border: '1px solid var(--border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            backgroundColor: statusConfig.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {task.type === 'upload' ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={statusConfig.color}
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={statusConfig.color}
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              {task.type === 'upload' ? t('queue.upload') : t('queue.download')}
            </span>
            <span
              style={{
                fontSize: '10px',
                padding: '2px 6px',
                borderRadius: '10px',
                backgroundColor: statusConfig.bg,
                color: statusConfig.color,
                fontWeight: 600,
              }}
            >
              {statusConfig.label}
            </span>
          </div>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={task.type === 'upload' ? task.localPath : task.remotePath}
          >
            {getFileName(task.type === 'upload' ? task.localPath : task.remotePath)}
          </div>
          <div
            style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              marginTop: '2px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={`${session?.config.protocol?.toUpperCase()}://${session?.config.host}:${session?.config.port}`}
          >
            {session?.config.protocol?.toUpperCase()} {sessionName}
          </div>
          {task.status === 'active' && (
            <div style={{ marginTop: '8px' }}>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}
              >
                <div
                  style={{
                    flex: 1,
                    height: '4px',
                    backgroundColor: 'var(--border)',
                    borderRadius: '2px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${task.progress}%`,
                      backgroundColor: statusConfig.color,
                      borderRadius: '2px',
                      transition: 'width 0.3s',
                    }}
                  />
                </div>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    color: statusConfig.color,
                    width: '32px',
                    textAlign: 'right',
                  }}
                >
                  {task.progress}%
                </span>
              </div>
            </div>
          )}
          {task.error && (
            <div
              style={{
                fontSize: '10px',
                color: '#f14c4c',
                marginTop: '6px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={task.error}
              >
                {task.error}
              </span>
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '2px',
            opacity: 0.6,
          }}
        >
          {task.status === 'active' && (
            <button
              onClick={() => cancelTask(task.id)}
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#f14c4c',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(241, 76, 76, 0.1)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              title={t('queue.cancel')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
          {task.status === 'failed' && (
            <button
              onClick={() => retryTask(task)}
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--accent)',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              title={t('queue.retry')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
              </svg>
            </button>
          )}
          {(task.status === 'completed' || task.status === 'failed') && (
            <button
              onClick={() => removeTask(task.id)}
              style={{
                padding: '4px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              title={t('queue.clear')}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
