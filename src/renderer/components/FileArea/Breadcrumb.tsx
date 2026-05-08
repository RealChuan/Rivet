import React from 'react'
import { useSessionStore } from '../../stores/sessionStore'

interface BreadcrumbProps {
  path: string
  sessionId: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ path, sessionId }) => {
  const { updateCurrentPath, refreshCurrentDirectory } = useSessionStore()

  const pathParts = path.split('/').filter(Boolean)

  const handleNavigate = async (targetPath: string) => {
    updateCurrentPath(sessionId, targetPath)
    await refreshCurrentDirectory(sessionId)
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '14px',
        overflowX: 'auto',
        flex: 1,
      }}
    >
      <button
        onClick={() => handleNavigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '4px',
          color: 'var(--text)',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontWeight: 500,
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        /
      </button>
      {pathParts.map((part, index) => {
        const fullPath = '/' + pathParts.slice(0, index + 1).join('/')

        return (
          <React.Fragment key={fullPath}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-muted)"
              strokeWidth="2"
              style={{ flexShrink: 0 }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            <button
              onClick={() => handleNavigate(fullPath)}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                color: 'var(--text-muted)',
                fontWeight: 400,
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <span
                style={{
                  maxWidth: '160px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {part}
              </span>
            </button>
          </React.Fragment>
        )
      })}
    </nav>
  )
}

export default Breadcrumb
