import { Maximize2, Minimize2, X } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../../components/ui/index.js'
import { cn } from '../../../utils/index.js'
import { useTerminalStore } from '../stores/terminal.js'
import { TerminalPanel } from './TerminalPanel.js'
import { TerminalTabs } from './TerminalTabs.js'

interface TerminalDrawerProps {
  sessionId: string
  cwd: string
}

/** 与传输队列同一套面板语言：平铺、无卡片、无独立底色，仅一条分隔线和 32px 头部。 */
export const TerminalDrawer = ({ sessionId, cwd }: TerminalDrawerProps) => {
  const { t } = useTranslation()
  const tabs = useTerminalStore((state) => state.tabsBySession[sessionId])
  const activeTabId = useTerminalStore((state) => state.activeTabBySession[sessionId])
  const statusByTab = useTerminalStore((state) => state.statusByTab)
  const errorByTab = useTerminalStore((state) => state.errorByTab)
  const ensureTab = useTerminalStore((state) => state.ensureTab)
  const isMaximized = useTerminalStore((state) => state.isMaximized)
  const toggleMaximize = useTerminalStore((state) => state.toggleMaximize)
  const close = useTerminalStore((state) => state.close)

  useEffect(() => {
    ensureTab(sessionId, cwd)
  }, [sessionId, cwd, ensureTab])

  // 终端与本会话同生共死：抽屉收起或换会话时清掉标签并关掉 ssh。
  useEffect(
    () => () => {
      useTerminalStore.getState().forget(sessionId)
    },
    [sessionId],
  )

  const activeStatus = activeTabId === undefined ? 'idle' : (statusByTab[activeTabId] ?? 'idle')

  return (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div
        className={cn(
          // 头部即标签栏：铺底色，顶部留一截白，激活标签贴住底边与终端连成一片。
          'flex h-8 shrink-0 items-stretch overflow-hidden bg-tabbar pl-2 pt-1',
          // 停靠态顶部由拖拽条画线，这里再画一条会出现双线。
          isMaximized && 'border-t border-border',
        )}
      >
        <TerminalTabs sessionId={sessionId} cwd={cwd} />

        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 pr-2">
          {activeStatus === 'connecting' && (
            <span className="shrink-0 text-2xs text-text-muted">
              {t(($) => $.terminal.status.connecting)}
            </span>
          )}
          {activeStatus === 'exited' && (
            <span className="shrink-0 text-2xs text-text-muted">
              {t(($) => $.terminal.status.exited)}
            </span>
          )}
          {activeStatus === 'error' && (
            <span className="shrink-0 text-2xs text-danger">
              {t(($) => $.terminal.status.error)}
            </span>
          )}

          <IconButton
            size="sm"
            onClick={toggleMaximize}
            label={
              isMaximized
                ? t(($) => $.terminal.action.restore)
                : t(($) => $.terminal.action.maximize)
            }
            testId="terminal-maximize"
            className="hover:bg-surface"
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
      </div>

      <div className="min-h-0 flex-1">
        {tabs?.map((tab) => {
          const isActive = tab.terminalId === activeTabId
          const error = errorByTab[tab.terminalId]
          return (
            // 只隐藏不卸载：重建 xterm 会丢回滚缓冲与历史输出。
            <div key={tab.terminalId} className={cn('h-full min-h-0', !isActive && 'hidden')}>
              {statusByTab[tab.terminalId] === 'error' && error ? (
                <div className="px-3 py-2 text-xs text-danger">{error}</div>
              ) : (
                <TerminalPanel
                  terminalId={tab.terminalId}
                  sessionId={sessionId}
                  cwd={tab.cwd}
                  isActive={isActive}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
