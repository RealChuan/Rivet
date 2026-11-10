import type { LocalFileInfo, TransferTask } from '@shared/types/index.js'
import { FILE_TYPE, TRANSFER_DIRECTION } from '@shared/constants/index.js'
import { joinPaths } from '@shared/utils/index.js'
import type { LocalFs } from './local-fs.js'
import { isLocalTempName, localTempPath } from '../utils/temp-path.js'

async function sweep(localFs: LocalFs, dir: string): Promise<void> {
  let entries: LocalFileInfo[]
  try {
    entries = await localFs.readdir(dir)
  } catch {
    // 目录已经不在了（用户删掉了目标目录）就没有半成品可清。
    return
  }

  await Promise.all(
    entries.map(async (entry) => {
      const path = joinPaths(dir, entry.name)
      if (entry.type === FILE_TYPE.DIRECTORY) {
        await sweep(localFs, path)
        return
      }
      if (isLocalTempName(entry.name)) await localFs.unlink(path).catch(() => {})
    }),
  )
}

/**
 * 移除任务时清掉它留下的本地半成品。
 * 单文件按确定的临时名删；目录只能重扫一遍，按后缀筛。
 * 上传的临时文件在远端临时名里，不在此列。
 */
export async function cleanupLocalTemps(localFs: LocalFs, task: TransferTask): Promise<void> {
  if (task.direction !== TRANSFER_DIRECTION.DOWNLOAD) return

  if (task.itemType === FILE_TYPE.DIRECTORY) {
    // 没用 resolvedLocalPath 说明还没解析目标，也就没写过任何半成品。
    if (task.resolvedLocalPath !== undefined) await sweep(localFs, task.resolvedLocalPath)
    return
  }

  const targets = new Set([task.localPath])
  if (task.resolvedLocalPath !== undefined) targets.add(task.resolvedLocalPath)

  for (const target of targets) {
    await localFs.unlink(localTempPath(target)).catch(() => {})
  }
}
