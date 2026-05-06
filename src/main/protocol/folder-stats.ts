import type { FolderStatsProgress } from '@shared/types/folder-stats.js'
import { TRANSFER_CONFIG } from '@shared/constants/index.js'
import type { FileProvider } from '../providers/types.js'

export interface FolderStatsOptions {
  signal: AbortSignal
  concurrency?: number
  onProgress: (progress: FolderStatsProgress) => void
}

/**
 * 基于 `FileProvider.list` 的递归统计。
 * 有界并发由固定数量的 worker 消费路径队列实现，不使用第三方并发库。
 */
export async function calculateFolderStats(
  provider: FileProvider,
  rootPath: string,
  opts: FolderStatsOptions,
): Promise<FolderStatsProgress> {
  const stats: FolderStatsProgress = {
    fileCount: 0,
    folderCount: 0,
    totalSize: 0,
    currentPath: rootPath,
    isComplete: false,
    isCancelled: false,
    errorCount: 0,
  }

  const queue: string[] = [rootPath]
  const concurrency = Math.max(
    TRANSFER_CONFIG.MIN_CONCURRENCY,
    opts.concurrency ?? TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  )

  const worker = async (): Promise<void> => {
    for (;;) {
      if (opts.signal.aborted) return

      const currentPath = queue.shift()
      if (currentPath === undefined) return

      stats.currentPath = currentPath

      try {
        for await (const entry of provider.list(currentPath, { signal: opts.signal })) {
          if (opts.signal.aborted) return
          if (entry.kind === 'directory') {
            stats.folderCount++
            queue.push(entry.path)
          } else {
            stats.fileCount++
            stats.totalSize += entry.size
          }
        }
      } catch {
        if (opts.signal.aborted) return
        stats.errorCount++
      }

      opts.onProgress({ ...stats })
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  stats.isCancelled = opts.signal.aborted
  stats.isComplete = !stats.isCancelled
  stats.currentPath = ''
  opts.onProgress({ ...stats })

  return stats
}
