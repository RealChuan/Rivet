import type React from 'react'
import { SplitPanel } from '@renderer/components/ui/index.js'
import { FileExplorerContainer } from '../features/file-explorer/index.js'
import { ConnectionSidebar } from '../features/session/index.js'

export const ConnectionPage: React.FC = () => {
  return (
    <SplitPanel
      left={<ConnectionSidebar />}
      right={<FileExplorerContainer />}
      widthSelector={state => state.connectionPanelWidth}
      setWidthSelector={state => state.setConnectionPanelWidth}
    />
  )
}
