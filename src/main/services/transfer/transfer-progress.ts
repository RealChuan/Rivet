import type {
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
  UploadOperation,
} from '@shared/types/index.js'
import {
  TRANSFER_CONFIG,
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
} from '@shared/constants/index.js'
import { FILE_TYPE } from '@shared/constants/ui.js'

export interface SpeedSample {
  timestamp: number
  transferredSize: number
}

const SPEED_WINDOW_MS = 3000
const SPEED_MIN_SAMPLES = 2

export function addSpeedSample(
  samples: Map<string, SpeedSample[]>,
  id: string,
  transferredSize: number,
): void {
  let list = samples.get(id)
  if (!list) {
    list = []
    samples.set(id, list)
  }
  const now = Date.now()
  list.push({ timestamp: now, transferredSize })
  const cutoff = now - SPEED_WINDOW_MS
  while (list.length > SPEED_MIN_SAMPLES && list[0] && list[0].timestamp < cutoff) {
    list.shift()
  }
}

export function computeSpeed(samples: Map<string, SpeedSample[]>, id: string): number {
  const list = samples.get(id)
  if (list && list.length >= SPEED_MIN_SAMPLES) {
    const oldest = list[0]
    const latest = list[list.length - 1]
    if (oldest && latest) {
      const elapsed = (latest.timestamp - oldest.timestamp) / 1000
      if (elapsed > 0) {
        return (latest.transferredSize - oldest.transferredSize) / elapsed
      }
    }
  }
  return 0
}

export function shouldThrottle(lastProgressTime: Map<string, number>, taskId: string): boolean {
  const now = Date.now()
  const lastTime = lastProgressTime.get(taskId) ?? 0
  return now - lastTime < TRANSFER_CONFIG.PROGRESS_THROTTLE_MS
}

export function markProgressSent(lastProgressTime: Map<string, number>, taskId: string): void {
  lastProgressTime.set(taskId, Date.now())
}

export function buildProgressData(
  task: TransferTask,
  speed: number,
  activeOperations?: OperationProgressInfo[],
): TransferProgressData {
  const data: TransferProgressData = {
    taskId: task.id,
    transferredSize: task.transferredSize,
  }
  if (task.fileSize > 0) data.fileSize = task.fileSize
  if (speed > 0) data.speed = speed
  if (task.totalFileCount !== undefined) data.totalFileCount = task.totalFileCount
  if (task.completedFileCount !== undefined) data.completedFileCount = task.completedFileCount
  if (task.activeFileCount !== undefined) data.activeFileCount = task.activeFileCount
  if (task.waitingFileCount !== undefined) data.waitingFileCount = task.waitingFileCount
  if (task.itemType === FILE_TYPE.DIRECTORY && activeOperations) {
    data.activeOperations = activeOperations
  }
  return data
}

export function getActiveOperationInfos(
  operationsByTask: Map<string, UploadOperation[]>,
  opSpeedSamples: Map<string, SpeedSample[]>,
  taskId: string,
): OperationProgressInfo[] {
  const taskOps = operationsByTask.get(taskId) ?? []
  const runningOps = taskOps.filter((op) => op.status === OPERATION_STATUS.RUNNING)
  const completedOps = taskOps
    .filter(
      (op) =>
        op.status === OPERATION_STATUS.COMPLETED &&
        (op.type === TRANSFER_OPERATION_TYPE.UPLOAD ||
          op.type === TRANSFER_OPERATION_TYPE.DOWNLOAD),
    )
    .slice(-TRANSFER_CONFIG.MAX_INLINE_OPERATIONS)

  return [...runningOps, ...completedOps].map((op) => {
    const opSpeed = computeSpeed(opSpeedSamples, op.id)
    const info: OperationProgressInfo = {
      id: op.id,
      itemName: op.itemName,
      type: op.type,
      transferredSize: op.transferredSize,
      status: op.status,
    }
    if (op.fileSize !== undefined) info.fileSize = op.fileSize
    if (op.startedAt !== undefined) info.startedAt = op.startedAt
    if (opSpeed > 0) info.speed = opSpeed
    return info
  })
}
