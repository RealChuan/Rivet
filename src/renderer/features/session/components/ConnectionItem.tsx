import React from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { PROTOCOL } from '@shared/constants/index.js'
import { type ConnectionConfig, type Session } from '@shared/types/index.js'

interface ConnectionItemProps {
  connection: ConnectionConfig
  session: Session | undefined
  isActive: boolean
  onSelect: () => void
  onDisconnect: () => void
  onReconnect: () => void
  onDelete: () => void
  onEdit: () => void
  style?: React.CSSProperties
}

export const ConnectionItem: React.FC<ConnectionItemProps> = ({
  connection,
  session,
  isActive,
  onSelect,
  onDisconnect,
  onReconnect,
  onDelete,
  onEdit,
  style,
}) => {
  const { t } = useTranslation()
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const [menuPosition, setMenuPosition] = React.useState<{
    top: number
    right: number
  } | null>(null)

  const isConnected = session?.isConnected ?? false
  const isLoading = session?.isLoading ?? false

  React.useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setMenuPosition({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      })
    }
  }, [showMenu])

  const protocolIcon =
    connection.protocol === PROTOCOL.SFTP ? (
      <svg className="w-3.5 h-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
        <path d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ) : (
      <svg className="w-3.5 h-3.5 stroke-current" viewBox="0 0 24 24" fill="none" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
      </svg>
    )

  return (
    <div className="relative" style={style}>
      <div
        onClick={onSelect}
        className={`
          mx-2 my-1 px-3 py-2.5 rounded-md cursor-pointer flex items-center gap-2.5
          border border-input-border transition-all duration-150
          ${
            isActive
              ? 'bg-selected border-l-2 border-l-accent border-y border-r border-y-transparent border-r-transparent'
              : 'bg-transparent hover:bg-hover border-l border-l-input-border'
          }
        `}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={`relative ${isConnected ? 'text-status-connected' : 'text-status-disconnected'}`}
          >
            {isConnected && (
              <span className="absolute -inset-0.5 rounded-full bg-status-connected/20 animate-status-pulse" />
            )}
            {isLoading ? (
              <svg
                className="w-3.5 h-3.5 animate-spin stroke-current stroke-2"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle cx="12" cy="12" r="10" className="opacity-25" />
                <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
              </svg>
            ) : isConnected ? (
              protocolIcon
            ) : (
              <svg
                className="w-3.5 h-3.5 stroke-current"
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="2"
              >
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            )}
          </div>
          <span
            className={`
              text-xs px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-[0.5px]
              ${
                connection.protocol === PROTOCOL.SFTP
                  ? 'text-accent bg-accent-light'
                  : 'text-protocol-webdav bg-protocol-webdav-light'
              }
            `}
          >
            {connection.protocol.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${isActive ? 'text-accent' : 'text-text'}`}>
            {connection.name ?? connection.host}
          </div>
          <div className="text-xs text-text-muted truncate">{connection.host}</div>
        </div>
        <button
          ref={buttonRef}
          onClick={e => {
            e.stopPropagation()
            setShowMenu(!showMenu)
          }}
          className="p-1 rounded shrink-0 text-text-muted bg-transparent border-none cursor-pointer hover:bg-hover transition-colors"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>

      {showMenu &&
        menuPosition &&
        ReactDOM.createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
            <div
              ref={menuRef}
              className="fixed z-50 bg-bg border border-border rounded-md p-1 min-w-30 shadow-dropdown animate-menu-in"
              style={{
                top: menuPosition.top,
                right: menuPosition.right,
              }}
            >
              {isConnected ? (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onDisconnect()
                    setShowMenu(false)
                  }}
                  className={`
                  w-full px-3 py-2 text-left text-xs text-text-muted bg-transparent border-none rounded
                  cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors
                `}
                >
                  <svg
                    className="w-3.5 h-3.5 stroke-current"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="2"
                  >
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
                  </svg>
                  {t('connection.disconnect')}
                </button>
              ) : (
                <button
                  onClick={e => {
                    e.stopPropagation()
                    onReconnect()
                    setShowMenu(false)
                  }}
                  className={`
                  w-full px-3 py-2 text-left text-xs text-status-connected bg-transparent border-none rounded
                  cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors
                `}
                >
                  <svg
                    className="w-3.5 h-3.5 stroke-current"
                    viewBox="0 0 24 24"
                    fill="none"
                    strokeWidth="2"
                  >
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 00-3-3.87" />
                    <path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                  {t('connection.connect')}
                </button>
              )}
              <div className="h-px bg-border my-1" />
              <button
                onClick={e => {
                  e.stopPropagation()
                  onEdit()
                  setShowMenu(false)
                }}
                className={`
                w-full px-3 py-2 text-left text-xs text-text bg-transparent border-none rounded
                cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors
              `}
              >
                <svg
                  className="w-3.5 h-3.5 stroke-current"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {t('connection.edit')}
              </button>
              <div className="h-px bg-border my-1" />
              <button
                onClick={e => {
                  e.stopPropagation()
                  onDelete()
                  setShowMenu(false)
                }}
                className={`
                w-full px-3 py-2 text-left text-xs text-danger bg-transparent border-none rounded
                cursor-pointer flex items-center gap-2 hover:bg-hover transition-colors
              `}
              >
                <svg
                  className="w-3.5 h-3.5 stroke-current"
                  viewBox="0 0 24 24"
                  fill="none"
                  strokeWidth="2"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                {t('action.delete')}
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  )
}

export default ConnectionItem
