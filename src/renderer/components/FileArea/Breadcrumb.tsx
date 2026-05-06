import React from 'react'
import { useSessionStore } from '../../stores/sessionStore'

interface BreadcrumbProps {
  path: string
  sessionId: string
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ path, sessionId }) => {
  const { updateCurrentPath } = useSessionStore()

  const pathParts = path.split('/').filter(Boolean)

  const handleNavigate = (targetPath: string) => {
    updateCurrentPath(sessionId, targetPath)
  }

  return (
    <nav
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        fontSize: '13px',
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
        Home
      </button>
      {pathParts.map((part, index) => {
        const fullPath = '/' + pathParts.slice(0, index + 1).join('/')
        const isLast = index === pathParts.length - 1

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
              onClick={() => !isLast && handleNavigate(fullPath)}
              disabled={isLast}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: isLast ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                color: isLast ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: isLast ? 500 : 400,
              }}
              onMouseEnter={e => {
                if (!isLast) e.currentTarget.style.backgroundColor = 'var(--hover)'
              }}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {isLast && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2"
                >
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                </svg>
              )}
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
