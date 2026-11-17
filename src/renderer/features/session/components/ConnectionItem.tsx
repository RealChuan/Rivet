import {
  Cloud,
  Terminal,
  Globe,
  Server,
  Plug,
  EllipsisVertical,
  KeyRound,
  LogOut,
  Pencil,
  Trash,
  XCircle,
} from 'lucide-react'
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui'
import { type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { PROTOCOL } from '@shared/constants/index.js'
import { type ConnectionConfig, type Session } from '@shared/types/index.js'
import { LoaderIcon } from '../../../components/common/index.js'
import { cn } from '../../../utils/index.js'
import { useDirectoryLoading } from '../../file-explorer/hooks/use-directory-list.js'
import { useIsConnecting } from '../stores/connect-requests.js'

/** 与文件右键菜单共用一套菜单项观感；`data-highlighted` 是 radix 的悬停/键盘高亮。 */
const MENU_ITEM_CLASS = cn(
  'w-full px-3 py-2 text-left text-xs text-text',
  'bg-transparent border-none rounded',
  'flex items-center gap-2 transition-colors',
  'data-highlighted:bg-hover data-highlighted:outline-none',
  'focus-visible:outline-none',
)

interface ConnectionItemProps {
  connection: ConnectionConfig
  session: Session | undefined
  isActive: boolean
  onSelect: () => void
  onDisconnect: () => void
  onReconnect: () => void
  onCancelConnect: () => void
  onDelete: () => void
  onEdit: () => void
  style?: CSSProperties
}

export const ConnectionItem = ({
  connection,
  session,
  isActive,
  onSelect,
  onDisconnect,
  onReconnect,
  onCancelConnect,
  onDelete,
  onEdit,
  style,
}: ConnectionItemProps) => {
  const { t } = useTranslation()

  const isConnected = session?.isConnected ?? false
  const isConnecting = useIsConnecting(connection.id)
  const isLoading = useDirectoryLoading(session?.sessionId ?? '')

  const protocolIcon =
    connection.protocol === PROTOCOL.SFTP ? (
      <Terminal className="w-3.5 h-3.5 stroke-current" />
    ) : connection.protocol === PROTOCOL.SMB ? (
      <Server className="w-3.5 h-3.5 stroke-current" />
    ) : connection.protocol === PROTOCOL.S3 ? (
      <Cloud className="w-3.5 h-3.5 stroke-current" />
    ) : (
      <Globe className="w-3.5 h-3.5 stroke-current" />
    )

  return (
    <div
      className="relative min-w-0"
      style={style}
      data-testid="connection-item"
      data-connection-id={connection.id}
    >
      <div
        onClick={onSelect}
        className={cn(
          'mx-2 px-3 py-2.5 rounded-md flex items-center gap-2.5 transition-all duration-150 border border-border',
          isActive
            ? 'bg-selected border-l-2 border-l-accent'
            : 'bg-transparent hover:bg-hover border-l-2 border-border',
        )}
      >
        <div className="flex items-center gap-2 shrink-0">
          <div
            className={cn(
              'relative',
              isConnecting
                ? 'text-accent'
                : isConnected
                  ? 'text-status-connected'
                  : 'text-status-disconnected',
            )}
          >
            {isConnected && !isConnecting && (
              <span className="absolute -inset-0.5 rounded-full bg-status-connected/20 animate-status-pulse" />
            )}
            {isConnecting || isLoading ? (
              <LoaderIcon className="w-3.5 h-3.5 animate-spin stroke-current" />
            ) : isConnected ? (
              protocolIcon
            ) : (
              <Plug className="w-3.5 h-3.5 stroke-current" />
            )}
          </div>
          {/* 定宽槽：徽标宽度随协议名长短变化，不留出固定列宽，名称与 host 的左边缘会逐行漂移。 */}
          <div className="w-15 shrink-0 flex">
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-[0.5px] whitespace-nowrap',
                connection.protocol === PROTOCOL.SFTP
                  ? 'text-accent bg-accent-light'
                  : connection.protocol === PROTOCOL.SMB
                    ? 'text-protocol-smb bg-protocol-smb-light'
                    : connection.protocol === PROTOCOL.S3
                      ? 'text-protocol-s3 bg-protocol-s3-light'
                      : 'text-protocol-webdav bg-protocol-webdav-light',
              )}
            >
              {connection.protocol.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div
            className={cn('text-sm font-medium truncate', isActive ? 'text-accent' : 'text-text')}
          >
            {connection.name ?? connection.host}
          </div>
          <div className="text-xs text-text-muted truncate">
            {isConnecting
              ? t(($) => $.connection.connecting, { host: connection.host })
              : connection.host}
          </div>
        </div>
        {connection.askPasswordOnConnect && (
          <KeyRound
            className="w-3.5 h-3.5 shrink-0 text-status-disconnected"
            data-testid="connection-needs-password"
            aria-label={t(($) => $.connectionDialog.askPasswordOnConnect)}
          />
        )}
        <DropdownMenuPrimitive.Root>
          <DropdownMenuPrimitive.Trigger asChild>
            <button
              onClick={(e) => {
                e.stopPropagation()
              }}
              onPointerDown={(e) => {
                // 指针事件冒泡到 dnd-kit 的拖拽监听会让"点菜单"变成"拖这一行"。
                e.stopPropagation()
              }}
              className="p-1 rounded shrink-0 text-text-muted bg-transparent border-none hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
              aria-label={t(($) => $.connection.moreActions)}
            >
              <EllipsisVertical className="w-3.5 h-3.5 fill-current" />
            </button>
          </DropdownMenuPrimitive.Trigger>

          <DropdownMenuPrimitive.Portal>
            {/* radix 负责碰撞检测：下方放不下就翻到按钮上方，贴近视口边缘时自动收拢。 */}
            <DropdownMenuPrimitive.Content
              align="end"
              sideOffset={4}
              collisionPadding={8}
              className="z-50 bg-glass-bg border border-glass-border rounded-md p-1 min-w-30 shadow-dropdown animate-menu-in"
              // 菜单挂在行内部：radix 的 portal 按 React 树冒泡，不拦住的话点菜单项会连带选中这一行。
              onClick={(e) => {
                e.stopPropagation()
              }}
            >
              {isConnecting ? (
                <DropdownMenuPrimitive.Item
                  className={cn(MENU_ITEM_CLASS, 'text-text-muted')}
                  data-testid="connection-cancel-connect"
                  onSelect={onCancelConnect}
                >
                  <XCircle className="w-3.5 h-3.5 stroke-current" />
                  {t(($) => $.connection.cancelConnect)}
                </DropdownMenuPrimitive.Item>
              ) : isConnected ? (
                <DropdownMenuPrimitive.Item
                  className={cn(MENU_ITEM_CLASS, 'text-text-muted')}
                  onSelect={onDisconnect}
                >
                  <LogOut className="w-3.5 h-3.5 stroke-current" />
                  {t(($) => $.connection.disconnect)}
                </DropdownMenuPrimitive.Item>
              ) : (
                <DropdownMenuPrimitive.Item
                  className={cn(MENU_ITEM_CLASS, 'text-status-connected')}
                  onSelect={onReconnect}
                >
                  <Plug className="w-3.5 h-3.5 stroke-current" />
                  {t(($) => $.connection.connect)}
                </DropdownMenuPrimitive.Item>
              )}

              <DropdownMenuPrimitive.Separator className="h-px bg-border my-1" />

              <DropdownMenuPrimitive.Item className={MENU_ITEM_CLASS} onSelect={onEdit}>
                <Pencil className="w-3.5 h-3.5 stroke-current" />
                {t(($) => $.connection.edit)}
              </DropdownMenuPrimitive.Item>

              <DropdownMenuPrimitive.Separator className="h-px bg-border my-1" />

              <DropdownMenuPrimitive.Item
                className={cn(MENU_ITEM_CLASS, 'text-danger')}
                onSelect={onDelete}
              >
                <Trash className="w-3.5 h-3.5 stroke-current" />
                {t(($) => $.common.action.delete)}
              </DropdownMenuPrimitive.Item>
            </DropdownMenuPrimitive.Content>
          </DropdownMenuPrimitive.Portal>
        </DropdownMenuPrimitive.Root>
      </div>
    </div>
  )
}

export default ConnectionItem
