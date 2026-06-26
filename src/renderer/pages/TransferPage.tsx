import { useEffect } from 'react'
import { Group, Panel } from 'react-resizable-panels'

import { ResizeSeparator } from '@renderer/components/ui/ResizeSeparator.js'
import { useUiStore } from '@renderer/stores/index.js'
import { MAX_PANEL_WIDTH, MIN_PANEL_WIDTH } from '@shared/constants/index.js'
import { TransferContainer } from '../features/transfer/components/TransferContainer.js'
import { TransferServerList } from '../features/transfer/components/TransferServerList.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'

export const TransferPage = () => {
  const setVisible = useTransferStore((state) => state.setVisible)
  const panelWidth = useUiStore((state) => state.transferPanelWidth)
  const setPanelWidth = useUiStore((state) => state.setTransferPanelWidth)

  useEffect(() => {
    setVisible(true)
    return () => setVisible(false)
  }, [setVisible])

  const sidebarPct = (panelWidth / window.innerWidth) * 100

  return (
    <Group
      orientation="horizontal"
      className="h-full"
      defaultLayout={{ 'transfer-sidebar': sidebarPct, 'transfer-content': 100 - sidebarPct }}
    >
      <Panel
        id="transfer-sidebar"
        minSize={`${MIN_PANEL_WIDTH}px`}
        maxSize={`${MAX_PANEL_WIDTH}px`}
        onResize={(s) => setPanelWidth(Math.round(s.inPixels))}
      >
        <TransferServerList />
      </Panel>
      <ResizeSeparator />
      <Panel id="transfer-content">
        <TransferContainer />
      </Panel>
    </Group>
  )
}
