import { useEffect } from 'react'
import { SplitPanel } from '@renderer/components/ui/index.js'
import { TransferContainer } from '../features/transfer/components/TransferContainer.js'
import { TransferServerList } from '../features/transfer/components/TransferServerList.js'
import { useTransferStore } from '../features/transfer/stores/transfer.js'

export const TransferPage = () => {
  const setVisible = useTransferStore((state) => state.setVisible)

  useEffect(() => {
    setVisible(true)
    return () => setVisible(false)
  }, [setVisible])

  return (
    <SplitPanel
      left={<TransferServerList />}
      right={<TransferContainer />}
      widthSelector={(state) => state.transferPanelWidth}
      setWidthSelector={(state) => state.setTransferPanelWidth}
    />
  )
}
