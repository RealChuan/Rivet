import { useTranslation } from 'react-i18next'
import type { TransferTask } from '@shared/types/transfer.js'
import { OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import { useTransferStore } from '../stores/transfer.js'
import { formatRemainingTime, formatSpeed } from '../utils/format.js'

interface QueueSummaryProps {
  tasks: TransferTask[]
  /** 展开态已经有方向计数标签，汇总行只留速度与剩余时间。 */
  showCounts: boolean
}

/** 收起态汇总行：单独订阅进度，避免每 200ms 重渲染整个面板。 */
export const QueueSummary = ({ tasks, showCounts }: QueueSummaryProps) => {
  const { t, i18n } = useTranslation()
  const taskProgress = useTransferStore((state) => state.taskProgress)

  let uploadCount = 0
  let downloadCount = 0
  let failedCount = 0
  let runningCount = 0
  let totalSpeed = 0
  let remainingBytes = 0
  let remainingUnknown = false

  for (const task of tasks) {
    if (task.direction === TRANSFER_DIRECTION.UPLOAD) uploadCount++
    else downloadCount++

    if (task.status === OPERATION_STATUS.FAILED) {
      failedCount++
      continue
    }
    if (task.status !== OPERATION_STATUS.RUNNING && task.status !== OPERATION_STATUS.WAITING) {
      continue
    }

    runningCount++
    const progress = taskProgress.get(task.id)
    const speed = progress?.speed ?? task.speed ?? 0
    const fileSize = progress?.fileSize ?? task.fileSize
    const transferred = progress?.transferredSize ?? task.transferredSize
    totalSpeed += speed

    // 文件夹扫描结束前字节总量只是“已发现”，此时算剩余时间会明显偏小。
    if (task.itemType === FILE_TYPE.DIRECTORY && progress?.scanCompleted !== true) {
      remainingUnknown = true
    }
    remainingBytes += Math.max(fileSize - transferred, 0)
  }

  const remainingSeconds =
    !remainingUnknown && totalSpeed > 0 && remainingBytes > 0
      ? remainingBytes / totalSpeed
      : Infinity

  return (
    <div className="flex items-center gap-3 min-w-0 overflow-hidden text-xs text-text-muted tabular-nums">
      {showCounts && (
        <>
          <span className="whitespace-nowrap">
            {t(($) => $.transfer.upload)} {uploadCount}
          </span>
          <span className="whitespace-nowrap">
            {t(($) => $.transfer.download)} {downloadCount}
          </span>
        </>
      )}
      {/* 聚合速度为 0 时不显示，避免出现一排 “-”。 */}
      {runningCount > 0 && totalSpeed > 0 && (
        <>
          <span className="whitespace-nowrap text-text-secondary">
            {formatSpeed(totalSpeed, i18n.language)}
          </span>
          {Number.isFinite(remainingSeconds) && (
            <span className="whitespace-nowrap">
              {t(($) => $.transfer.queue.remaining, {
                time: formatRemainingTime(remainingSeconds),
              })}
            </span>
          )}
        </>
      )}
      {failedCount > 0 && (
        <span className="whitespace-nowrap text-danger">
          {t(($) => $.transfer.status.failedCount, { count: failedCount })}
        </span>
      )}
    </div>
  )
}
