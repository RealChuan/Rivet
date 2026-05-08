import React from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useQueueStore } from '../../stores/queueStore'
import TaskItem from './TaskItem'

export const QueueDrawer: React.FC = () => {
  const { queueDrawerOpen, queueDrawerWidth, setQueueDrawerOpen } = useUiStore()
  const { tasks, clearCompletedTasks } = useQueueStore()

  if (!queueDrawerOpen) return null

  const activeTasks = tasks.filter(t => t.status === 'active' || t.status === 'pending')
  const completedTasks = tasks.filter(t => t.status === 'completed' || t.status === 'failed')

  return (
    <div
      style={{
        height: '100%',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg)',
        width: queueDrawerWidth,
      }}
      className="animate-slideInRight"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
            Transfer Queue
          </h2>
          {activeTasks.length > 0 && (
            <span
              style={{
                padding: '2px 8px',
                fontSize: '10px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: 'var(--accent)',
                fontWeight: 600,
              }}
            >
              {activeTasks.length}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {completedTasks.length > 0 && (
            <button
              onClick={clearCompletedTasks}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Clear
            </button>
          )}
          <button
            onClick={() => setQueueDrawerOpen(false)}
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
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tasks.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                backgroundColor: 'var(--hover)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px',
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="1.5"
              >
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>No transfers</p>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            {activeTasks.map(task => (
              <TaskItem key={task.id} task={task} />
            ))}
            {completedTasks.length > 0 && (
              <>
                <div style={{ padding: '12px 16px 4px' }}>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 600,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
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
