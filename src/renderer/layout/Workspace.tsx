import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Group, Panel } from 'react-resizable-panels'
import {
  DEFAULT_QUEUE_PANEL_HEIGHT,
  MAX_PANEL_WIDTH,
  MAX_QUEUE_PANEL_HEIGHT_RATIO,
  MIN_PANEL_WIDTH,
  MIN_QUEUE_PANEL_HEIGHT,
  PROTOCOL,
  QUEUE_PANEL_COLLAPSED_HEIGHT,
} from '@shared/constants/index.js'
import { QUEUE_PANEL_MODE } from '@shared/constants/transfer.js'
import { ResizeSeparator } from '../components/ui/ResizeSeparator.js'
import { VerticalResizeHandle } from '../components/ui/VerticalResizeHandle.js'
import { FileExplorerContainer } from '../features/file-explorer/index.js'
import { ConnectionSidebar } from '../features/session/index.js'
import { useConnectionStore } from '../features/session/stores/connection.js'
import { useSessionStore } from '../features/session/stores/session.js'
import {
  DEFAULT_TERMINAL_HEIGHT,
  TerminalDrawer,
  useTerminalStore,
} from '../features/terminal/index.js'
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

  const activeSession = useSessionStore((state) =>
    state.sessions.find((session) => session.sessionId === state.activeSessionId),
  )
  const connections = useConnectionStore((state) => state.connections)
  const protocol = connections.find((item) => item.id === activeSession?.connectionId)?.protocol
  const terminalOpen = useTerminalStore((state) => state.isOpen)
  const terminalMaximized = useTerminalStore((state) => state.isMaximized)
  const terminalHeight = useTerminalStore((state) => state.height)
  const setTerminalHeight = useTerminalStore((state) => state.setHeight)
  // 终端只属于 SFTP：切到其他协议时抽屉自动收起。
  const showTerminal = terminalOpen && protocol === PROTOCOL.SFTP && activeSession !== undefined

  const isMaximized = hasTasks && mode === QUEUE_PANEL_MODE.MAXIMIZED
  const isCollapsed = mode === QUEUE_PANEL_MODE.COLLAPSED
  // 任一面板最大化时文件区不可交互，避免键盘落到看不见的列表上。
  const isFileAreaBlocked = isMaximized || (showTerminal && terminalMaximized)

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
      <div className="flex-1 min-h-0" inert={isFileAreaBlocked}>
        <FileExplorerContainer />
      </div>

      {showTerminal && !terminalMaximized && (
        <VerticalResizeHandle
          value={terminalHeight}
          onResize={setTerminalHeight}
          onReset={() => setTerminalHeight(DEFAULT_TERMINAL_HEIGHT)}
          label={t(($) => $.terminal.title)}
        />
      )}

      {/* 最大化只改容器定位，不挪父节点：换父节点会重建 xterm，历史全丢。 */}
      {showTerminal && (
        <div
          className={terminalMaximized ? 'absolute inset-0 z-20 bg-bg' : 'shrink-0'}
          style={terminalMaximized ? undefined : { height: terminalHeight }}
        >
          <TerminalDrawer sessionId={activeSession.sessionId} cwd={activeSession.currentPath} />
        </div>
      )}

      {hasTasks && !isMaximized && !terminalMaximized && (
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
