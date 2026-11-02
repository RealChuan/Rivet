import { formatFileSize } from '@shared/utils/index.js'

/** 剩余时间统一格式：`45s` / `2m30s` / `1h05m`，不可计算时返回 `-`。 */
export function formatRemainingTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '-'
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60)
    const s = Math.round(seconds % 60)
    return `${m}m${s}s`
  }
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return `${h}h${m}m`
}

/** 按剩余字节与瞬时速度估算剩余秒数；无法估算时返回 `Infinity`。 */
export function computeRemainingSeconds(
  transferredSize: number,
  fileSize: number,
  speed: number,
): number {
  if (speed <= 0 || fileSize <= 0) return Infinity
  const remaining = fileSize - transferredSize
  if (remaining <= 0) return 0
  return remaining / speed
}

export function formatSpeed(bytesPerSecond: number, lng: string): string {
  if (bytesPerSecond <= 0) return '-'
  return `${formatFileSize(bytesPerSecond, lng)}/s`
}
