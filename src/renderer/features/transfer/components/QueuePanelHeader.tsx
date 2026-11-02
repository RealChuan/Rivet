import { ChevronDown, ChevronUp, Maximize2, Minimize2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SortOrderWithDirection } from '@shared/constants/sort.js'
import type { TransferSortField } from '@shared/constants/transfer.js'
import type { TransferTask } from '@shared/types/transfer.js'
import {
  QUEUE_PANEL_MODE,
  TRANSFER_DIRECTION,
  TRANSFER_SCOPE,
  type QueuePanelMode,
  type TransferDirection,
  type TransferScope,
} from '@shared/constants/transfer.js'
import Select from '../../../components/ui/Select.js'
import { useUiStore } from '../../../stores/ui.js'
import { cn } from '../../../utils/index.js'
import { QueueSettingsPopover } from './QueueSettingsPopover.js'
import { QueueSummary } from './QueueSummary.js'
import { SortDropdown } from './SortDropdown.js'

interface QueuePanelHeaderProps {
  mode: QueuePanelMode
  /** 收起态汇总用全部任务，不受 scope 影响。 */
  summaryTasks: TransferTask[]
  uploadCount: number
  downloadCount: number
  activeTab: TransferDirection
  scope: TransferScope
  sortBy: TransferSortField
  sortOrder: SortOrderWithDirection
  hasActiveTasks: boolean
  onTabChange: (direction: TransferDirection) => void
  onScopeChange: (scope: TransferScope) => void
  onSort: (field: TransferSortField) => void
  onCancelAll: () => void
}

const iconButtonClass =
  'w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-hover transition-colors cursor-default focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2'

export const QueuePanelHeader = ({
  mode,
  summaryTasks,
  uploadCount,
  downloadCount,
  activeTab,
  scope,
  sortBy,
  sortOrder,
  hasActiveTasks,
  onTabChange,
  onScopeChange,
  onSort,
  onCancelAll,
}: QueuePanelHeaderProps) => {
  const { t } = useTranslation()
  const setQueuePanelMode = useUiStore((state) => state.setQueuePanelMode)

  const isCollapsed = mode === QUEUE_PANEL_MODE.COLLAPSED
  const isMaximized = mode === QUEUE_PANEL_MODE.MAXIMIZED

  const handleScopeChange = (value: string) => {
    if (value === TRANSFER_SCOPE.CURRENT || value === TRANSFER_SCOPE.ALL) onScopeChange(value)
  }

  const tabClass = (isActive: boolean) =>
    cn(
      'flex items-center gap-1 px-2 h-6 rounded-md text-xs transition-colors cursor-default',
      'focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
      isActive ? 'bg-accent-light text-accent' : 'text-text-muted hover:bg-hover hover:text-text',
    )

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 h-8 px-2 shrink-0 overflow-hidden',
        // 展开态顶部由拖拽条画线，这里再画一条会出现双线。
        (isCollapsed || isMaximized) && 'border-t border-border',
      )}
      data-testid="queue-panel-header"
    >
      <button
        type="button"
        className={iconButtonClass}
        onClick={() =>
          setQueuePanelMode(isCollapsed ? QUEUE_PANEL_MODE.EXPANDED : QUEUE_PANEL_MODE.COLLAPSED)
        }
        aria-label={
          isCollapsed ? t(($) => $.transfer.queue.expand) : t(($) => $.transfer.queue.collapse)
        }
        title={
          isCollapsed ? t(($) => $.transfer.queue.expand) : t(($) => $.transfer.queue.collapse)
        }
      >
        {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {!isCollapsed && (
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={tabClass(activeTab === TRANSFER_DIRECTION.UPLOAD)}
            onClick={() => onTabChange(TRANSFER_DIRECTION.UPLOAD)}
            aria-pressed={activeTab === TRANSFER_DIRECTION.UPLOAD}
          >
            <span>{t(($) => $.transfer.upload)}</span>
            <span className="tabular-nums">{uploadCount}</span>
          </button>
          <button
            type="button"
            className={tabClass(activeTab === TRANSFER_DIRECTION.DOWNLOAD)}
            onClick={() => onTabChange(TRANSFER_DIRECTION.DOWNLOAD)}
            aria-pressed={activeTab === TRANSFER_DIRECTION.DOWNLOAD}
          >
            <span>{t(($) => $.transfer.download)}</span>
            <span className="tabular-nums">{downloadCount}</span>
          </button>
        </div>
      )}

      <QueueSummary tasks={summaryTasks} showCounts={isCollapsed} />

      <div className="flex-1" />

      {!isCollapsed && (
        <>
          <Select
            testId="queue-scope"
            ariaLabel={t(($) => $.transfer.queue.scope)}
            value={scope}
            onChange={handleScopeChange}
            options={[
              { value: TRANSFER_SCOPE.CURRENT, label: t(($) => $.transfer.queue.scopeCurrent) },
              { value: TRANSFER_SCOPE.ALL, label: t(($) => $.transfer.queue.scopeAll) },
            ]}
            className="w-24 h-6 min-h-6 py-0 px-2 text-[11px]"
          />
          <SortDropdown sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
          <QueueSettingsPopover />
        </>
      )}

      <button
        type="button"
        className={iconButtonClass}
        onClick={() =>
          setQueuePanelMode(isMaximized ? QUEUE_PANEL_MODE.EXPANDED : QUEUE_PANEL_MODE.MAXIMIZED)
        }
        aria-label={
          isMaximized ? t(($) => $.transfer.queue.restore) : t(($) => $.transfer.queue.maximize)
        }
        title={
          isMaximized ? t(($) => $.transfer.queue.restore) : t(($) => $.transfer.queue.maximize)
        }
      >
        {isMaximized ? (
          <Minimize2 className="w-3.5 h-3.5" />
        ) : (
          <Maximize2 className="w-3.5 h-3.5" />
        )}
      </button>

      {!isCollapsed && hasActiveTasks && (
        <button
          type="button"
          className="w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-danger bg-transparent hover:bg-danger-light transition-colors cursor-default focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
          onClick={onCancelAll}
          aria-label={t(($) => $.transfer.action.cancelAll)}
          title={t(($) => $.transfer.action.cancelAll)}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
