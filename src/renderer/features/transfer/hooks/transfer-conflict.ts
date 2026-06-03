import type { FileInfo } from '@shared/types/index.js'
import type { ConflictItem, ConflictResolution } from '@shared/types/transfer.js'
import {
  CONFLICT_ACTION,
  type ConflictAction,
  type TransferItemType,
} from '@shared/constants/transfer.js'
import { joinPaths, pathBasename } from '@shared/utils/index.js'

export function detectConflicts(
  localPaths: string[],
  remoteFiles: FileInfo[],
  remoteDir: string,
  itemType: TransferItemType
): ConflictItem[] {
  const remoteFileMap = new Map(remoteFiles.map(f => [f.name, f]))
  const detected: ConflictItem[] = []

  for (const localPath of localPaths) {
    const name = pathBasename(localPath)
    const remoteFile = remoteFileMap.get(name)
    if (remoteFile) {
      detected.push({
        localPath,
        remotePath: joinPaths(remoteDir, name),
        itemName: name,
        itemType,
        remoteFileType: remoteFile.type,
      })
    }
  }

  return detected
}

export function applyResolutions(
  localPaths: string[],
  resolutions: ConflictResolution[],
  remoteDir: string,
  _itemType: TransferItemType
): {
  localPath: string
  remotePath: string
  itemName: string
  conflictAction?: ConflictAction
  renamedName?: string
}[] {
  const resolutionMap = new Map(resolutions.map(r => [r.localPath, r]))
  const skipSet = new Set<string>()

  for (const resolution of resolutions) {
    if (resolution.action === CONFLICT_ACTION.SKIP) {
      skipSet.add(resolution.localPath)
    }
  }

  return localPaths
    .filter(p => !skipSet.has(p))
    .map(localPath => {
      const name = pathBasename(localPath)
      const resolution = resolutionMap.get(localPath)

      if (resolution) {
        if (resolution.action === CONFLICT_ACTION.OVERWRITE) {
          return {
            localPath,
            remotePath: joinPaths(remoteDir, name),
            itemName: name,
            conflictAction: CONFLICT_ACTION.OVERWRITE as ConflictAction,
          }
        }
        if (resolution.action === CONFLICT_ACTION.KEEP_BOTH && resolution.newName) {
          return {
            localPath,
            remotePath: joinPaths(remoteDir, resolution.newName),
            itemName: resolution.newName,
            renamedName: resolution.newName,
          }
        }
      }

      return {
        localPath,
        remotePath: joinPaths(remoteDir, name),
        itemName: name,
      }
    })
}
