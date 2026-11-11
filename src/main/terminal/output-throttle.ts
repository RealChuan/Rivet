/**
 * 单帧上限：按字节切，拼回后再切块，保证每帧与原字节流逐字节一致。
 */
const MAX_CHUNK_BYTES = 64 * 1024

/** 积压上限：超过就让上游暂停，避免长时间大输出把主进程内存吃满。 */
const MAX_PENDING_BYTES = 1024 * 1024

export interface OutputThrottleOptions {
  flushMs: number
  send: (data: Uint8Array) => void
  /** 背压回调：终端流据此 pause/resume 上游。 */
  onBackpressure: (paused: boolean) => void
}

/**
 * 终端输出的唯一出口：把 ssh2 的高频小 chunk 攒成帧再发；
 * 积压时暂停上游，绝不丢字节。
 */
export class OutputThrottle {
  private readonly flushMs: number
  private readonly send: (data: Uint8Array) => void
  private readonly onBackpressure: (paused: boolean) => void
  private pending: Buffer[] = []
  private buffered = 0
  private timer: NodeJS.Timeout | null = null
  private paused = false
  private disposed = false

  constructor(options: OutputThrottleOptions) {
    this.flushMs = options.flushMs
    this.send = options.send
    this.onBackpressure = options.onBackpressure
  }

  get pendingBytes(): number {
    return this.buffered
  }

  push(chunk: Buffer): void {
    if (this.disposed || chunk.length === 0) return

    this.pending.push(chunk)
    this.buffered += chunk.length

    if (!this.paused && this.buffered >= MAX_PENDING_BYTES) {
      this.paused = true
      this.onBackpressure(true)
    }

    if (this.buffered >= MAX_CHUNK_BYTES) {
      this.flush()
      return
    }

    this.schedule()
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (this.disposed) return
    if (this.buffered === 0) return

    const all = Buffer.concat(this.pending)
    this.pending = []
    this.buffered = 0

    if (all.length <= MAX_CHUNK_BYTES) {
      this.send(all)
    } else {
      this.send(all.subarray(0, MAX_CHUNK_BYTES))
      const rest = all.subarray(MAX_CHUNK_BYTES)
      this.pending.push(rest)
      this.buffered = rest.length
      this.schedule()
    }

    if (this.paused && this.buffered < MAX_CHUNK_BYTES) {
      this.paused = false
      this.onBackpressure(false)
    }
  }

  dispose(): void {
    this.disposed = true
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    this.pending = []
    this.buffered = 0
  }

  private schedule(): void {
    if (this.timer !== null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, this.flushMs)
    // 主进程不该因为一帧待发输出而挂住退出流程。
    this.timer.unref?.()
  }
}
