import type React from 'react'
import { cn } from '@renderer/utils/index.js'
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
  const isRunning = status === TRANSFER_TASK_STATUS.RUNNING
  const isFailed = status === TRANSFER_TASK_STATUS.FAILED
  const showIndeterminate = isRunning && percentage === 0

  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden min-w-16 relative">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            isFailed ? 'bg-danger' : 'bg-accent',
            showIndeterminate && 'animate-progress-indeterminate'
          )}
          style={{ width: `${percentage}%` }}
        />
        {showIndeterminate && (
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/20 to-transparent animate-progress-shimmer" />
          </div>
        )}
      </div>
      <span className="text-xs text-text-muted tabular-nums w-8 text-right shrink-0">
        {percentage}%
      </span>
    </div>
  )
}
