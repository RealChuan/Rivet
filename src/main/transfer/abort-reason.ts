/**
 * 暂停与取消都靠 abort 打断传输，只有 reason 能区分二者：
 * 暂停要留下临时文件（下次接着下），取消要清理干净。
 */
export const TRANSFER_PAUSE_REASON = { paused: true } as const

export function isPauseAbort(signal: AbortSignal): boolean {
  return signal.aborted && signal.reason === TRANSFER_PAUSE_REASON
}
