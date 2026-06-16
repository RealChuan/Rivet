import type React from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConflictStrategy } from '@renderer/components/common/ConflictDialogBase.js'
import type { FileInfo } from '@shared/types/index.js'
import {
  CONFLICT_STRATEGY,
  ConflictDialogBase,
} from '@renderer/components/common/ConflictDialogBase.js'
import { FileIcon } from '@renderer/components/common/index.js'
import { logger } from '@renderer/utils/index.js'
import { FILE_OPERATION } from '@shared/constants/index.js'

export interface ConflictItem {
  sourceFile: FileInfo
  targetFile: FileInfo | null
  targetExists: boolean
}

export interface ConflictResolution {
  sourceFile: FileInfo
  targetFile: FileInfo
  strategy: ConflictStrategy
}

type CopyMoveOperation = typeof FILE_OPERATION.COPY | typeof FILE_OPERATION.MOVE

interface ConflictDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (
    resolutions: ConflictResolution[],
    operation?: CopyMoveOperation,
    files?: FileInfo[],
    targetDir?: FileInfo | null
  ) => void | Promise<void>
  conflicts: ConflictItem[]
  operation?: CopyMoveOperation
  files?: FileInfo[]
  targetDir?: FileInfo | null
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  open,
  onClose,
  onConfirm,
  conflicts,
  operation,
  files,
  targetDir,
}) => {
  const { t } = useTranslation()

  const canOverwriteFn = (index: number): boolean => {
    const conflict = conflicts[index]
    if (!conflict) return true
    const sourceType = conflict.sourceFile.type
    const targetType = conflict.targetFile?.type
    if (!targetType) return true
    return sourceType === targetType
  }

  const handleConfirm = (strategies: ConflictStrategy[]) => {
    logger.info('[Copy] ConflictDialog handleConfirm called')
    const resolutions: ConflictResolution[] = conflicts.map((c, i) => ({
      sourceFile: c.sourceFile,
      targetFile: c.targetFile ?? c.sourceFile,
      strategy: strategies[i] ?? CONFLICT_STRATEGY.KEEP_BOTH,
    }))
    if (onConfirm) {
      void onConfirm(resolutions, operation, files, targetDir)
    }
    onClose()
  }

  const renderConflictInfo = (index: number): React.ReactNode => {
    const conflict = conflicts[index]
    if (!conflict) return null

    return (
      <div className="flex items-center gap-3 mb-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileIcon type={conflict.sourceFile.type} />
            <span className="text-sm text-text font-medium truncate">
              {conflict.sourceFile.name}
            </span>
          </div>
          <div
            className="text-xs text-text-muted truncate"
            title={conflict.sourceFile.absolutePath}
          >
            {t('conflict.source')}: {conflict.sourceFile.absolutePath}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 stroke-text-muted stroke-2 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileIcon type={conflict.targetFile?.type ?? conflict.sourceFile.type} />
            <span className="text-sm text-danger font-medium truncate">
              {conflict.targetFile?.name ?? conflict.sourceFile.name}
            </span>
          </div>
          <div
            className="text-xs text-text-muted truncate"
            title={conflict.targetFile?.absolutePath ?? conflict.sourceFile.absolutePath}
          >
            {t('conflict.target')}:{' '}
            {conflict.targetFile?.absolutePath ?? conflict.sourceFile.absolutePath}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ConflictDialogBase
      open={open}
      onClose={onClose}
      onConfirm={handleConfirm}
      conflictCount={conflicts.length}
      hideOverwrite={operation === FILE_OPERATION.MOVE}
      canOverwrite={canOverwriteFn}
      renderConflictInfo={renderConflictInfo}
    />
  )
}

export default ConflictDialog
