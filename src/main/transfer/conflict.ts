import type { TransferTask } from '@shared/types/index.js'
import { CONFLICT_ACTION, ERROR_CODE } from '@shared/constants/index.js'
import {
  generateUniqueFilename,
  getParentPath,
  joinPaths,
  normalizePath,
} from '@shared/utils/index.js'
import type { FileProvider } from '../providers/types.js'
import type { LocalFs } from './local-fs.js'
import { ProviderError } from '../providers/errors.js'

export interface ConflictOptions {
  signal?: AbortSignal
}

export type ConflictTarget = { skip: true } | { path: string; overwrite: boolean }

async function remoteExists(
  provider: FileProvider,
  path: string,
  signal: AbortSignal | undefined,
): Promise<boolean> {
  try {
    await provider.stat(path, signal)
    return true
  } catch (error) {
    if (error instanceof ProviderError && error.code === ERROR_CODE.NOT_FOUND) {
      return false
    }
    throw error
  }
}

async function localExists(localFs: LocalFs, path: string): Promise<boolean> {
  try {
    await localFs.stat(path)
    return true
  } catch {
    return false
  }
}

async function keepBothName(
  baseName: string,
  exists: (candidate: string) => Promise<boolean>,
): Promise<string> {
  let candidate = generateUniqueFilename(baseName)
  let counter = 1

  while (await exists(candidate)) {
    const extIndex = candidate.lastIndexOf('.')
    const name = extIndex > 0 ? candidate.slice(0, extIndex) : candidate
    const ext = extIndex > 0 ? candidate.slice(extIndex) : ''
    candidate = `${name} (${counter})${ext}`
    counter += 1
  }

  return candidate
}

export async function resolveUploadTarget(
  provider: FileProvider,
  task: TransferTask,
  opts: ConflictOptions = {},
): Promise<ConflictTarget> {
  const target = normalizePath(task.remotePath)
  if (!(await remoteExists(provider, target, opts.signal))) {
    return { path: target, overwrite: false }
  }

  const action = task.conflictAction ?? CONFLICT_ACTION.OVERWRITE
  if (action === CONFLICT_ACTION.SKIP) return { skip: true }
  if (action === CONFLICT_ACTION.OVERWRITE) return { path: target, overwrite: true }

  const dir = getParentPath(target)
  const name =
    task.renamedName ??
    (await keepBothName(task.itemName, (candidate) =>
      remoteExists(provider, joinPaths(dir, candidate), opts.signal),
    ))

  return { path: joinPaths(dir, name), overwrite: false }
}

export async function resolveDownloadTarget(
  localFs: LocalFs,
  task: TransferTask,
  _opts: ConflictOptions = {},
): Promise<ConflictTarget> {
  if (!task.localDir) {
    throw new Error('localDir is required for download')
  }

  const dir = normalizePath(task.localDir)
  const target = joinPaths(dir, task.renamedName ?? task.itemName)
  if (!(await localExists(localFs, target))) {
    return { path: target, overwrite: false }
  }

  const action = task.conflictAction ?? CONFLICT_ACTION.OVERWRITE
  if (action === CONFLICT_ACTION.SKIP) return { skip: true }
  if (action === CONFLICT_ACTION.OVERWRITE) return { path: target, overwrite: true }

  const name =
    task.renamedName ??
    (await keepBothName(task.itemName, (candidate) =>
      localExists(localFs, joinPaths(dir, candidate)),
    ))

  return { path: joinPaths(dir, name), overwrite: false }
}
