import type React from 'react'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ConflictAction } from '@shared/constants/index.js'
import type { ConflictResolution } from '@shared/types/index.js'
import { CONFLICT_ACTION } from '@shared/constants/index.js'
import { generateUniqueFilename } from '@shared/utils/index.js'
import { ConflictDialogBase } from '../../../components/common/ConflictDialogBase.js'
import { FileIcon } from '../../../components/common/index.js'
import { useTransferConflictStore } from '../stores/transfer-conflict.js'

export const TransferConflictDialog = () => {
  const { t } = useTranslation()
  const dialogOpen = useTransferConflictStore((state) => state.dialogOpen)
  const conflicts = useTransferConflictStore((state) => state.conflicts)

  const canOverwriteFn = (index: number): boolean => {
    const conflict = conflicts[index]
    if (!conflict) return true
    return conflict.itemType === conflict.remoteFileType
  }

  const handleConfirm = (strategies: ConflictAction[]) => {
    const result: ConflictResolution[] = conflicts.map((c, i) => {
      const action = strategies[i] ?? CONFLICT_ACTION.KEEP_BOTH
      return {
        localPath: c.localPath,
        action,
        ...(action === CONFLICT_ACTION.KEEP_BOTH
          ? { newName: generateUniqueFilename(c.itemName) }
          : {}),
      }
    })
    useTransferConflictStore.getState().confirm(result)
  }

  const handleCancel = () => {
    useTransferConflictStore.getState().cancel()
  }

  const renderConflictInfo = (index: number): React.ReactNode => {
    const conflict = conflicts[index]
    if (!conflict) return null
    const sourceType = conflict.itemType
    const targetType = conflict.remoteFileType

    return (
      <div className="flex items-center gap-3 mb-3 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileIcon type={sourceType} />
            <span className="text-sm text-text font-medium truncate">{conflict.itemName}</span>
          </div>
          <div className="text-xs text-text-muted truncate" title={conflict.localPath}>
            {t(($) => $.conflict.source)}: {conflict.localPath}
          </div>
        </div>

        <ChevronRight className="w-4 h-4 stroke-text-muted stroke-2 shrink-0" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <FileIcon type={targetType} />
            <span className="text-sm text-danger font-medium truncate">{conflict.itemName}</span>
          </div>
          <div className="text-xs text-text-muted truncate" title={conflict.remotePath}>
            {t(($) => $.conflict.target)}: {conflict.remotePath}
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
      canOverwrite={canOverwriteFn}
      renderConflictInfo={renderConflictInfo}
    />
  )
}

export default TransferConflictDialog
