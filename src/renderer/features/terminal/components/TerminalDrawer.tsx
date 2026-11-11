import { Maximize2, Minimize2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../../components/ui/index.js'
import { cn } from '../../../utils/index.js'
import { useTerminalStore } from '../stores/terminal.js'
import { TerminalPanel } from './TerminalPanel.js'

interface TerminalDrawerProps {
  sessionId: string
  cwd: string
}

/** 与传输队列同一套面板语言：平铺、无卡片、无独立底色，仅一条分隔线和 32px 头部。 */
export const TerminalDrawer = ({ sessionId, cwd }: TerminalDrawerProps) => {
  const { t } = useTranslation()
  const status = useTerminalStore((state) => state.statusBySession[sessionId] ?? 'idle')
  const error = useTerminalStore((state) => state.errorBySession[sessionId])
  const isMaximized = useTerminalStore((state) => state.isMaximized)
  const toggleMaximize = useTerminalStore((state) => state.toggleMaximize)
  const close = useTerminalStore((state) => state.close)

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div
        className={cn(
          // 与文件列表表头同构：h-8 + 下边框，把操作按钮和内容分开。
          'flex h-8 shrink-0 items-center gap-1.5 overflow-hidden border-b border-border px-2',
          // 停靠态顶部由拖拽条画线，这里再画一条会出现双线。
          isMaximized && 'border-t',
        )}
      >
        <span className="text-2xs font-medium text-text-muted">{t(($) => $.terminal.title)}</span>

        {status === 'connecting' && (
          <span className="text-2xs text-text-muted">{t(($) => $.terminal.status.connecting)}</span>
        )}
        {status === 'exited' && (
          <span className="text-2xs text-text-muted">{t(($) => $.terminal.status.exited)}</span>
        )}
        {status === 'error' && (
          <span className="text-2xs text-danger">{t(($) => $.terminal.status.error)}</span>
        )}

        <div className="flex-1" />

        <IconButton
          size="sm"
          onClick={toggleMaximize}
          label={
            isMaximized ? t(($) => $.terminal.action.restore) : t(($) => $.terminal.action.maximize)
          }
          testId="terminal-maximize"
        >
          {isMaximized ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </IconButton>

        <IconButton
          size="sm"
          variant="close"
          onClick={close}
          label={t(($) => $.terminal.action.close)}
          testId="terminal-close"
        >
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1">
        {status === 'error' && error ? (
          <div className="px-3 py-2 text-xs text-danger">{error}</div>
        ) : (
          <TerminalPanel sessionId={sessionId} cwd={cwd} />
        )}
      </div>
    </div>
  )
}
