import type React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTransferStore } from '../stores/transfer.js'
import { TransferArea } from './TransferArea.js'

export const TransferContainer: React.FC = () => {
  const { t } = useTranslation()
  const sessionIds = useTransferStore(state => state.sessionIds)
  const selectedSessionId = useTransferStore(state => state.selectedSessionId)

  if (sessionIds.length === 0 || !selectedSessionId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-transparent">
        <div className="text-center p-8">
          <div
            className={`
              w-16 h-16 mx-auto mb-4 rounded-xl
              bg-hover border border-border flex items-center justify-center
            `}
          >
            <ArrowUpDown className="w-7 h-7 stroke-text-muted stroke-[1.5]" />
          </div>
          <h3 className="text-sm font-medium text-text mb-1.5">{t('transfer.empty')}</h3>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {selectedSessionId && <TransferArea sessionId={selectedSessionId} />}
    </div>
  )
}
