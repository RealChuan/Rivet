import type React from 'react'
import { TRANSFER_TASK_STATUS } from '@shared/constants/transfer.js'

interface TransferProgressBarProps {
  transferred: number
  total: number
  status: string
}

export const TransferProgressBar: React.FC<TransferProgressBarProps> = ({
  transferred,
  total,
  status,
}) => {
  const percentage = total > 0 ? Math.min(Math.round((transferred / total) * 100), 100) : 0

  const barColor = status === TRANSFER_TASK_STATUS.FAILED ? 'bg-danger' : 'bg-accent'

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden min-w-16">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-text-muted tabular-nums w-8 text-right shrink-0">
        {percentage}%
      </span>
    </div>
  )
}
