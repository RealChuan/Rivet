import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Group, Panel } from 'react-resizable-panels'
import {
  DEFAULT_QUEUE_PANEL_HEIGHT,
  MAX_PANEL_WIDTH,
  MAX_QUEUE_PANEL_HEIGHT_RATIO,
  MIN_PANEL_WIDTH,
  MIN_QUEUE_PANEL_HEIGHT,
  QUEUE_PANEL_COLLAPSED_HEIGHT,
} from '@shared/constants/index.js'
import { QUEUE_PANEL_MODE } from '@shared/constants/transfer.js'
import { ResizeSeparator } from '../components/ui/ResizeSeparator.js'
import { VerticalResizeHandle } from '../components/ui/VerticalResizeHandle.js'
import { FileExplorerContainer } from '../features/file-explorer/index.js'
import { ConnectionSidebar } from '../features/session/index.js'
import { QueuePanel } from '../features/transfer/components/QueuePanel.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'
import { useUiStore } from '../stores/index.js'

const MIN_FILE_AREA_HEIGHT = 160

const WorkspaceContent = () => {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const mode = useUiStore((state) => state.queuePanelMode)
  const setMode = useUiStore((state) => state.setQueuePanelMode)
  const height = useUiStore((state) => state.queuePanelHeight)
  const setHeight = useUiStore((state) => state.setQueuePanelHeight)
  const hasTasks = useTransferStore((state) => state.tasks.length > 0)

  const isMaximized = hasTasks && mode === QUEUE_PANEL_MODE.MAXIMIZED
  const isCollapsed = mode === QUEUE_PANEL_MODE.COLLAPSED

  // 任务清空后回落为展开态，否则下次任务会直接铺满。
  useEffect(() => {
    if (!hasTasks && mode === QUEUE_PANEL_MODE.MAXIMIZED) {
      setMode(QUEUE_PANEL_MODE.EXPANDED)
    }
  }, [hasTasks, mode, setMode])

  const clampHeight = (next: number) => {
    const available = containerRef.current?.clientHeight ?? 0
    const byRatio = Math.round(available * MAX_QUEUE_PANEL_HEIGHT_RATIO)
    const byFileArea = available - MIN_FILE_AREA_HEIGHT
    const max = Math.max(MIN_QUEUE_PANEL_HEIGHT, Math.min(byRatio, byFileArea))
    return Math.min(max, Math.max(MIN_QUEUE_PANEL_HEIGHT, Math.round(next)))
  }

  const handleResize = (next: number) => {
    setHeight(clampHeight(next))
  }

  return (
    <div ref={containerRef} className="relative flex flex-col h-full min-w-0 overflow-hidden">
      <div className="flex-1 min-h-0" inert={isMaximized}>
        <FileExplorerContainer />
      </div>

      {hasTasks && !isMaximized && (
        <>
          {!isCollapsed && (
            <VerticalResizeHandle
              value={height}
              onResize={handleResize}
              onReset={() => setHeight(DEFAULT_QUEUE_PANEL_HEIGHT)}
              label={t(($) => $.transfer.queue.resize)}
            />
          )}
          <div
            className="shrink-0"
            style={{ height: isCollapsed ? QUEUE_PANEL_COLLAPSED_HEIGHT : height }}
          >
            <QueuePanel />
          </div>
        </>
      )}

      {hasTasks && isMaximized && (
        <div className="absolute inset-0 z-20 bg-bg-secondary">
          <QueuePanel />
        </div>
      )}
    </div>
  )
}

export const Workspace = () => {
  const panelWidth = useUiStore((state) => state.connectionPanelWidth)
  const setPanelWidth = useUiStore((state) => state.setConnectionPanelWidth)
  const sidebarPct = (panelWidth / window.innerWidth) * 100

  return (
    <Group
      orientation="horizontal"
      className="h-full"
      defaultLayout={{ 'connection-sidebar': sidebarPct, 'connection-content': 100 - sidebarPct }}
    >
      <Panel
        id="connection-sidebar"
        minSize={`${MIN_PANEL_WIDTH}px`}
        maxSize={`${MAX_PANEL_WIDTH}px`}
        onResize={(s) => setPanelWidth(Math.round(s.inPixels))}
      >
        <ConnectionSidebar />
      </Panel>
      <ResizeSeparator />
      <Panel id="connection-content">
        <WorkspaceContent />
      </Panel>
    </Group>
  )
}
