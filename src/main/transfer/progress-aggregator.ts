import type { TransferProgressData } from '@shared/types/transfer.js'

export interface ProgressAggregatorOptions {
  flushMs: number
  send: (batch: TransferProgressData[]) => void
}

/**
 * 主进程唯一的进度聚合器：同一 task 在一个窗口内只保留最后一条快照，
 * 定时器到点后一次性发送数组，渲染层不再自己缓冲。
 */
export class ProgressAggregator {
  private readonly flushMs: number
  private readonly send: (batch: TransferProgressData[]) => void
  private pending = new Map<string, TransferProgressData>()
  private timer: NodeJS.Timeout | null = null

  constructor(options: ProgressAggregatorOptions) {
    this.flushMs = options.flushMs
    this.send = options.send
  }

  get pendingCount(): number {
    return this.pending.size
  }

  update(data: TransferProgressData): void {
    this.pending.set(data.taskId, data)
    this.timer ??= setTimeout(() => {
      this.flush()
    }, this.flushMs)
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
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
  }
}
