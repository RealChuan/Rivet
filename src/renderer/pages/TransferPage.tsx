import type React from 'react'
import { SplitPanel } from '@renderer/components/ui/index.js'
import { TransferContainer } from '../features/transfer/components/TransferContainer.js'
import { TransferServerList } from '../features/transfer/components/TransferServerList.js'

export const TransferPage: React.FC = () => {
  return (
    <SplitPanel
      left={<TransferServerList />}
      right={<TransferContainer />}
      widthSelector={state => state.transferPanelWidth}
      setWidthSelector={state => state.setTransferPanelWidth}
    />
  )
}
