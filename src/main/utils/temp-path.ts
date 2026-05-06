import crypto from 'node:crypto'
import { getParentPath, joinPaths, pathBasename } from '@shared/utils/index.js'

/**
 * 临时文件命名约定：
 * - 远端原子写 `.<name>.<uuid>.rivet-tmp`，与目标同目录、隐藏、不会与用户文件撞名；
 * - 本地下载 `<path>.rivet-download`，rename 覆盖目标前先写这里。
 */
const REMOTE_TEMP_SUFFIX = '.rivet-tmp'
const LOCAL_TEMP_SUFFIX = '.rivet-download'

export function remoteTempPath(target: string): string {
  const name = pathBasename(target)
  return joinPaths(getParentPath(target), `.${name}.${crypto.randomUUID()}${REMOTE_TEMP_SUFFIX}`)
}

export function localTempPath(target: string): string {
  return `${target}${LOCAL_TEMP_SUFFIX}`
}
