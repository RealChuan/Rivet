import type React from 'react'
import { useTranslation } from 'react-i18next'
import type { ConflictStrategy } from '@renderer/components/common/ConflictDialogBase.js'
import type { ConflictAction, TransferItemType } from '@shared/constants/transfer.js'
import type { ConflictResolution } from '@shared/types/transfer.js'
import {
  ConflictDialogBase,
  CONFLICT_STRATEGY,
} from '@renderer/components/common/ConflictDialogBase.js'
import FileIcon from '@renderer/components/common/FileIcon.js'
import { CONFLICT_ACTION, TRANSFER_ITEM_TYPE } from '@shared/constants/transfer.js'
import { generateUniqueFilename } from '@shared/utils/index.js'
import { useTransferConflictStore } from '../stores/transfer-conflict.js'

const toFileType = (itemType: TransferItemType): 'file' | 'directory' =>
  itemType === TRANSFER_ITEM_TYPE.FOLDER ? 'directory' : 'file'

const toFileTypeFromString = (type?: string): 'file' | 'directory' =>
  type === 'directory' ? 'directory' : 'file'

const strategyToAction = (strategy: ConflictStrategy): ConflictAction => {
  if (strategy === CONFLICT_STRATEGY.SKIP) return CONFLICT_ACTION.SKIP
  if (strategy === CONFLICT_STRATEGY.OVERWRITE) return CONFLICT_ACTION.OVERWRITE
  return CONFLICT_ACTION.KEEP_BOTH
}

export const TransferConflictDialog: React.FC = () => {
  const { t } = useTranslation()
  const dialogOpen = useTransferConflictStore(state => state.dialogOpen)
  const conflicts = useTransferConflictStore(state => state.conflicts)

  const canOverwriteFn = (index: number): boolean => {
    const conflict = conflicts[index]
    if (!conflict) return true
    const sourceType = toFileType(conflict.itemType)
    const targetType = toFileTypeFromString(conflict.remoteFileType)
    return sourceType === targetType
  }

  const handleConfirm = (strategies: ConflictStrategy[]) => {
    const result: ConflictResolution[] = conflicts.map((c, i) => ({
      localPath: c.localPath,
      action: strategyToAction(strategies[i] ?? CONFLICT_STRATEGY.KEEP_BOTH),
      ...(strategies[i] === CONFLICT_STRATEGY.KEEP_BOTH
        ? { newName: generateUniqueFilename(c.itemName) }
        : {}),
    }))
    useTransferConflictStore.getState().confirm(result)
  }

  const handleCancel = () => {
    useTransferConflictStore.getState().cancel()
  }

  const renderConflictInfo = (index: number): React.ReactNode => {
    const conflict = conflicts[index]
    if (!conflict) return null
    const sourceType = toFileType(conflict.itemType)
    const targetType = toFileTypeFromString(conflict.remoteFileType)

    return (
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileIcon type={sourceType} />
            <span className="text-sm text-text font-medium">{conflict.itemName}</span>
          </div>
          <div className="text-xs text-text-muted">
            {t('transfer.conflict.source')}: {conflict.localPath}
          </div>
        </div>

        <svg className="w-4 h-4 stroke-text-muted stroke-2" viewBox="0 0 24 24" fill="none">
          <polyline points="9 18 15 12 9 6" />
        </svg>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <FileIcon type={targetType} />
            <span className="text-sm text-danger font-medium">{conflict.itemName}</span>
          </div>
          <div className="text-xs text-text-muted">
            {t('transfer.conflict.target')}: {conflict.remotePath}
          </div>
        </div>
      </div>
    )
  }

  return (
    <ConflictDialogBase
      open={dialogOpen}
      onClose={handleCancel}
      onConfirm={handleConfirm}
      conflictCount={conflicts.length}
      i18nPrefix="transfer.conflict"
      canOverwrite={canOverwriteFn}
      renderConflictInfo={renderConflictInfo}
    />
  )
}

export default TransferConflictDialog
