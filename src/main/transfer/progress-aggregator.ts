import type { TransferProgressData } from '@shared/types/transfer.js'

export interface ProgressAggregatorOptions {
  flushMs: number
  send: (batch: TransferProgressData[]) => void
}

const SPEED_SAMPLE_MIN_MS = 200
const SPEED_EMA_ALPHA = 0.4
const SPEED_STALE_MS = 30_000

interface SpeedSample {
  bytes: number
  at: number
}

/**
 * 主进程唯一的进度聚合器：同一 task 在一个窗口内只保留最后一条快照，
 * 定时器到点后一次性发送数组。速度也在这里按采样窗口算。
 */
export class ProgressAggregator {
  private readonly flushMs: number
  private readonly send: (batch: TransferProgressData[]) => void
  private pending = new Map<string, TransferProgressData>()
  private timer: NodeJS.Timeout | null = null
  private readonly samples = new Map<string, SpeedSample>()
  private readonly speeds = new Map<string, number>()

  constructor(options: ProgressAggregatorOptions) {
    this.flushMs = options.flushMs
    this.send = options.send
  }

  get pendingCount(): number {
    return this.pending.size
  }

  update(data: TransferProgressData): void {
    this.pending.set(data.taskId, this.withSpeed(data))
    this.timer ??= setTimeout(() => {
      this.flush()
    }, this.flushMs)
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.pruneSpeeds()
    if (this.pending.size === 0) return

    const batch = [...this.pending.values()]
    this.pending.clear()
    this.send(batch)
  }

  dispose(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.pending.clear()
    this.samples.clear()
    this.speeds.clear()
  }

  private withSpeed(data: TransferProgressData): TransferProgressData {
    const now = Date.now()
    const sample = this.samples.get(data.taskId)

    if (sample === undefined) {
      this.samples.set(data.taskId, { bytes: data.transferredSize, at: now })
    } else if (now - sample.at >= SPEED_SAMPLE_MIN_MS) {
      const seconds = (now - sample.at) / 1000
      const delta = data.transferredSize - sample.bytes
      if (seconds > 0 && delta >= 0) {
        const instant = delta / seconds
        const previous = this.speeds.get(data.taskId)
        this.speeds.set(
          data.taskId,
          previous === undefined ? instant : previous + (instant - previous) * SPEED_EMA_ALPHA,
        )
      }
      this.samples.set(data.taskId, { bytes: data.transferredSize, at: now })
    }

    const speed = this.speeds.get(data.taskId)
    return speed === undefined ? data : { ...data, speed }
  }

  private pruneSpeeds(): void {
    const now = Date.now()
    for (const [taskId, sample] of this.samples) {
      if (now - sample.at > SPEED_STALE_MS) {
        this.samples.delete(taskId)
        this.speeds.delete(taskId)
      }
    }
  }
}
