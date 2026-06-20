import type { FileType } from '@shared/constants/ui.js'
import type { ConflictResolution } from '@shared/types/transfer.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import { joinPaths, pathBasename } from '@shared/utils/index.js'
import type { TargetFileEntry } from './transfer-conflict.js'
import type { ResolvedTask } from './transfer-task-builder.js'
import { useTransferConflictStore } from '../stores/transfer-conflict.js'
import { applyResolutions, detectConflicts } from './transfer-conflict.js'

interface ResolveParams {
  localPaths: string[]
  remoteFiles: TargetFileEntry[]
  remoteDir: string
  itemType: FileType
}

export async function resolveConflictsAndBuildTasks(
  params: ResolveParams,
): Promise<ResolvedTask[] | null> {
  const { localPaths, remoteFiles, remoteDir, itemType } = params

  const conflicts = detectConflicts(localPaths, remoteFiles, remoteDir, itemType)

  if (conflicts.length > 0) {
    const resolutions = await new Promise<ConflictResolution[] | null>((resolve) => {
      useTransferConflictStore.getState().openDialog(conflicts, resolve)
    })

    if (!resolutions) return null

    return applyResolutions(localPaths, resolutions, remoteDir, itemType)
  }

  return localPaths.map((p) => ({
    localPath: p,
    remotePath: joinPaths(remoteDir, pathBasename(p)),
    itemName: pathBasename(p),
  }))
}

interface MixedResolveParams {
  filePaths: string[]
  folderPaths: string[]
  remoteFiles: TargetFileEntry[]
  remoteDir: string
}

export async function resolveMixedConflicts(
  params: MixedResolveParams,
): Promise<{ resolvedFilePaths: ResolvedTask[]; resolvedFolderPaths: ResolvedTask[] } | null> {
  const { filePaths, folderPaths, remoteFiles, remoteDir } = params

  const fileConflicts = detectConflicts(filePaths, remoteFiles, remoteDir, FILE_TYPE.FILE)
  const folderConflicts = detectConflicts(folderPaths, remoteFiles, remoteDir, FILE_TYPE.DIRECTORY)
  const allConflicts = [...fileConflicts, ...folderConflicts]

  let resolvedFilePaths: ResolvedTask[]
  let resolvedFolderPaths: ResolvedTask[]

  if (allConflicts.length > 0) {
    const resolutions = await new Promise<ConflictResolution[] | null>((resolve) => {
      useTransferConflictStore.getState().openDialog(allConflicts, resolve)
    })

    if (!resolutions) return null

    resolvedFilePaths = applyResolutions(filePaths, resolutions, remoteDir, FILE_TYPE.FILE)
    resolvedFolderPaths = applyResolutions(folderPaths, resolutions, remoteDir, FILE_TYPE.DIRECTORY)
  } else {
    resolvedFilePaths = filePaths.map((p) => ({
      localPath: p,
      remotePath: joinPaths(remoteDir, pathBasename(p)),
      itemName: pathBasename(p),
    }))
    resolvedFolderPaths = folderPaths.map((p) => ({
      localPath: p,
      remotePath: joinPaths(remoteDir, pathBasename(p)),
      itemName: pathBasename(p),
    }))
  }

  return { resolvedFilePaths, resolvedFolderPaths }
}
