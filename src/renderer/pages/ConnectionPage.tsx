import { SplitPanel } from '@renderer/components/ui/index.js'
import { FileExplorerContainer } from '../features/file-explorer/index.js'
import { ConnectionSidebar } from '../features/session/index.js'

export const ConnectionPage = () => {
  return (
    <SplitPanel
      left={<ConnectionSidebar />}
      right={<FileExplorerContainer />}
      widthSelector={(state) => state.connectionPanelWidth}
      setWidthSelector={(state) => state.setConnectionPanelWidth}
    />
  )
}
