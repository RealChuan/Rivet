import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { IconButton } from '../../../components/ui/index.js'
import { cn } from '../../../utils/index.js'
import { useTerminalStore } from '../stores/terminal.js'

interface TerminalTabsProps {
  sessionId: string
  /** 新建标签时 `cd` 到这个目录；已有标签不受影响。 */
  cwd: string
}

/** 浏览器式标签条：靠标签栏底色与激活项底色区分，不用分割线。 */
export const TerminalTabs = ({ sessionId, cwd }: TerminalTabsProps) => {
  const { t } = useTranslation()
  const tabs = useTerminalStore((state) => state.tabsBySession[sessionId])
  const activeTabId = useTerminalStore((state) => state.activeTabBySession[sessionId])
  const addTab = useTerminalStore((state) => state.addTab)
  const removeTab = useTerminalStore((state) => state.removeTab)
  const setActiveTab = useTerminalStore((state) => state.setActiveTab)

  return (
    <div className="flex min-w-0 items-stretch" data-testid="terminal-tabs">
      <div className="flex min-w-0 items-stretch overflow-x-auto overflow-y-hidden">
        {tabs?.map((tab) => {
          const isActive = tab.terminalId === activeTabId
          return (
            <div
              key={tab.terminalId}
              className={cn(
                'flex shrink-0 items-stretch rounded-t-md transition-colors',
                isActive
                  ? 'bg-tab-active text-text'
                  : 'text-text-muted hover:bg-surface/50 hover:text-text',
              )}
            >
              <button
                type="button"
                className="flex max-w-40 min-w-0 cursor-default items-center pl-3 pr-3 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:-outline-offset-2"
                onClick={() => setActiveTab(sessionId, tab.terminalId)}
                aria-pressed={isActive}
                data-testid={`terminal-tab-${tab.index}`}
              >
                <span className="min-w-0 truncate text-xs">
                  {t(($) => $.terminal.tab.title, { index: tab.index })}
                </span>
              </button>
              <button
                type="button"
                className="my-auto mr-1.5 flex h-5 w-5 shrink-0 cursor-default items-center justify-center rounded-md text-text-muted transition-colors hover:bg-danger hover:text-white focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:-outline-offset-2"
                onClick={() => removeTab(sessionId, tab.terminalId)}
                aria-label={t(($) => $.terminal.tab.close)}
                title={t(($) => $.terminal.tab.close)}
                data-testid={`terminal-tab-close-${tab.index}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      <div className="flex shrink-0 items-center pl-1 pr-2">
        <IconButton
          size="sm"
          onClick={() => addTab(sessionId, cwd)}
          label={t(($) => $.terminal.action.newTab)}
          testId="terminal-tab-new"
          className="hover:bg-surface"
        >
          <Plus className="h-3.5 w-3.5" />
        </IconButton>
      </div>
    </div>
  )
}
