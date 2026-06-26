import { Group, Panel } from 'react-resizable-panels'

import { ResizeSeparator } from '@renderer/components/ui/ResizeSeparator.js'
import { useUiStore } from '@renderer/stores/index.js'
import { MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from '@shared/constants/index.js'
import { FileExplorerContainer } from '../features/file-explorer/index.js'
import { ConnectionSidebar } from '../features/session/index.js'

export const ConnectionPage = () => {
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
        <FileExplorerContainer />
      </Panel>
    </Group>
  )
}
