import type { ConflictAction } from '@shared/constants/transfer.js'
import type { FileType } from '@shared/constants/ui.js'
import type { ConflictItem, ConflictResolution } from '@shared/types/transfer.js'
import { CONFLICT_ACTION } from '@shared/constants/transfer.js'
import { joinPaths, pathBasename } from '@shared/utils/index.js'

export interface TargetFileEntry {
  name: string
  type: FileType
}

export function detectConflicts(
  sourcePaths: string[],
  targetFiles: TargetFileEntry[],
  targetDir: string,
  itemType: FileType,
): ConflictItem[] {
  const targetFileMap = new Map(targetFiles.map((f) => [f.name, f]))
  const detected: ConflictItem[] = []

  for (const sourcePath of sourcePaths) {
    const name = pathBasename(sourcePath)
    const targetFile = targetFileMap.get(name)
    if (targetFile) {
      detected.push({
        localPath: sourcePath,
        remotePath: joinPaths(targetDir, name),
        itemName: name,
        itemType,
        remoteFileType: targetFile.type,
      })
    }
  }

  return detected
}

export function applyResolutions(
  sourcePaths: string[],
  resolutions: ConflictResolution[],
  targetDir: string,
  _itemType: FileType,
): {
  localPath: string
  remotePath: string
  itemName: string
  conflictAction?: ConflictAction
  renamedName?: string
}[] {
  const resolutionMap = new Map(resolutions.map((r) => [r.localPath, r]))
  const skipSet = new Set<string>()

  for (const resolution of resolutions) {
    if (resolution.action === CONFLICT_ACTION.SKIP) {
      skipSet.add(resolution.localPath)
    }
  }

  return sourcePaths
    .filter((p) => !skipSet.has(p))
    .map((sourcePath) => {
      const name = pathBasename(sourcePath)
      const resolution = resolutionMap.get(sourcePath)

      if (resolution) {
        if (resolution.action === CONFLICT_ACTION.OVERWRITE) {
          return {
            localPath: sourcePath,
            remotePath: joinPaths(targetDir, name),
            itemName: name,
            conflictAction: CONFLICT_ACTION.OVERWRITE,
          }
        }
        if (resolution.action === CONFLICT_ACTION.KEEP_BOTH && resolution.newName) {
          return {
            localPath: sourcePath,
            remotePath: joinPaths(targetDir, resolution.newName),
            itemName: resolution.newName,
            renamedName: resolution.newName,
          }
        }
      }

      return {
        localPath: sourcePath,
        remotePath: joinPaths(targetDir, name),
        itemName: name,
      }
    })
}
