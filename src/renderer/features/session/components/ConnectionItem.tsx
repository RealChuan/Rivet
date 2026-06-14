import { Terminal, Globe, Plug, EllipsisVertical, LogOut, Pencil, Trash } from 'lucide-react'
import React from 'react'
import ReactDOM from 'react-dom'
import { useTranslation } from 'react-i18next'
import { LoaderIcon } from '@renderer/components/common/index.js'
import { cn } from '@renderer/utils/index.js'
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
      <Terminal className="w-3.5 h-3.5 stroke-current" />
    ) : (
      <Globe className="w-3.5 h-3.5 stroke-current" />
    )

  return (
    <div className="relative" style={{ ...style, minWidth: 200 }}>
      <div
        onClick={onSelect}
        className={cn(
          'mx-2 px-3 py-2.5 rounded-md cursor-pointer flex items-center gap-2.5 transition-all duration-150 border border-border',
          isActive
            ? 'bg-selected border-l-2 border-l-accent'
            : 'bg-transparent hover:bg-hover border-l-2 border-border'
        )}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={cn(
              'relative',
              isConnected ? 'text-status-connected' : 'text-status-disconnected'
            )}
          >
            {isConnected && (
              <span className="absolute -inset-0.5 rounded-full bg-status-connected/20 animate-status-pulse" />
            )}
            {isLoading ? (
              <LoaderIcon className="w-3.5 h-3.5 animate-spin stroke-current" />
            ) : isConnected ? (
              protocolIcon
            ) : (
              <Plug className="w-3.5 h-3.5 stroke-current" />
            )}
          </div>
          <span
            className={cn(
              'text-xs px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-[0.5px]',
              connection.protocol === PROTOCOL.SFTP
                ? 'text-accent bg-accent-light'
                : 'text-protocol-webdav bg-protocol-webdav-light'
            )}
          >
            {connection.protocol.toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn('text-sm font-medium truncate', isActive ? 'text-accent' : 'text-text')}
          >
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
          className="p-1 rounded shrink-0 text-text-muted bg-transparent border-none cursor-pointer hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
          aria-label={t('connection.moreActions')}
        >
          <EllipsisVertical className="w-3.5 h-3.5 fill-current" />
        </button>
      </div>

      {showMenu &&
        menuPosition &&
        ReactDOM.createPortal(
          <>
            <div className="fixed inset-0 z-50" onClick={() => setShowMenu(false)} />
            <div
              ref={menuRef}
              className="fixed z-50 bg-glass-bg backdrop-blur-xl border border-border rounded-md p-1 min-w-30 shadow-dropdown animate-menu-in"
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
                  focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
                `}
                >
                  <LogOut className="w-3.5 h-3.5 stroke-current" />
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
                  focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
                `}
                >
                  <Plug className="w-3.5 h-3.5 stroke-current" />
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
                focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
              `}
              >
                <Pencil className="w-3.5 h-3.5 stroke-current" />
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
                focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2
              `}
              >
                <Trash className="w-3.5 h-3.5 stroke-current" />
                {t('common.action.delete')}
              </button>
            </div>
          </>,
          document.body
        )}
    </div>
  )
}

export default ConnectionItem
