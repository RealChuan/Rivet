import type React from 'react'
import { SplitPanel } from '@renderer/components/ui/index.js'
import { TransferList } from '@renderer/features/transfer/components/TransferList.js'
import { TransferServerList } from '@renderer/features/transfer/components/TransferServerList.js'

export const TransferPage: React.FC = () => {
  return (
    <SplitPanel
      left={<TransferServerList />}
      right={<TransferList />}
      widthSelector={state => state.transferPanelWidth}
      setWidthSelector={state => state.setTransferPanelWidth}
    />
  )
}
