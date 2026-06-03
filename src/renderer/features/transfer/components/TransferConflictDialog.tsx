import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConflictAction, TransferItemType } from '@shared/constants/transfer.js'
import type { ConflictItem, ConflictResolution } from '@shared/types/transfer.js'
import FileIcon from '@renderer/components/common/FileIcon.js'
import Button from '@renderer/components/ui/Button.js'
import { Checkbox } from '@renderer/components/ui/Checkbox.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import RadioButton from '@renderer/components/ui/RadioButton.js'
import { CONFLICT_ACTION, TRANSFER_ITEM_TYPE } from '@shared/constants/transfer.js'
import { generateUniqueFilename } from '@shared/utils/index.js'
import { useTransferConflictStore } from '../stores/transfer-conflict.js'

const CONFLICT_STRATEGY = {
  SKIP: 'skip',
  KEEP_BOTH: 'keepBoth',
  OVERWRITE: 'overwrite',
} as const

type ConflictStrategy = (typeof CONFLICT_STRATEGY)[keyof typeof CONFLICT_STRATEGY]

interface ItemResolution {
  localPath: string
  itemName: string
  strategy: ConflictStrategy
}

const toFileType = (itemType: TransferItemType): 'file' | 'directory' =>
  itemType === TRANSFER_ITEM_TYPE.FOLDER ? 'directory' : 'file'

const toFileTypeFromString = (type?: string): 'file' | 'directory' =>
  type === 'directory' ? 'directory' : 'file'

const strategyToAction = (strategy: ConflictStrategy): ConflictAction => {
  if (strategy === CONFLICT_STRATEGY.SKIP) return CONFLICT_ACTION.SKIP
  if (strategy === CONFLICT_STRATEGY.OVERWRITE) return CONFLICT_ACTION.OVERWRITE
  return CONFLICT_ACTION.KEEP_BOTH
}

const canOverwrite = (conflict: ConflictItem): boolean => {
  const sourceType = toFileType(conflict.itemType)
  const targetType = toFileTypeFromString(conflict.remoteFileType)
  return sourceType === targetType
}

export const TransferConflictDialog: React.FC = () => {
  const { t } = useTranslation()
  const dialogOpen = useTransferConflictStore(state => state.dialogOpen)
  const conflicts = useTransferConflictStore(state => state.conflicts)

  const [resolutions, setResolutions] = useState<ItemResolution[]>([])
  const [applyToAll, setApplyToAll] = useState(false)
  const [globalStrategy, setGlobalStrategy] = useState<ConflictStrategy>(
    CONFLICT_STRATEGY.KEEP_BOTH
  )
  const [prevOpen, setPrevOpen] = useState(false)

  if (dialogOpen && dialogOpen !== prevOpen) {
    setResolutions(
      conflicts.map(c => ({
        localPath: c.localPath,
        itemName: c.itemName,
        strategy: CONFLICT_STRATEGY.KEEP_BOTH,
      }))
    )
    setApplyToAll(false)
    setGlobalStrategy(CONFLICT_STRATEGY.KEEP_BOTH)
    setPrevOpen(true)
  }

  if (!dialogOpen && prevOpen) {
    setPrevOpen(false)
  }

  const handleStrategyChange = (index: number, strategy: ConflictStrategy) => {
    if (applyToAll) {
      setResolutions(prev => prev.map(r => ({ ...r, strategy })))
      setGlobalStrategy(strategy)
    } else {
      setResolutions(prev => {
        const next = [...prev]
        const current = next[index]
        if (current) {
          next[index] = { ...current, strategy }
        }
        return next
      })
    }
  }

  const handleConfirm = () => {
    const result: ConflictResolution[] = resolutions.map(r => ({
      localPath: r.localPath,
      action: strategyToAction(r.strategy),
      ...(r.strategy === CONFLICT_STRATEGY.KEEP_BOTH
        ? { newName: generateUniqueFilename(r.itemName) }
        : {}),
    }))

    const resolveRef = useTransferConflictStore.getState()._resolveRef
    useTransferConflictStore.getState().closeDialog()
    resolveRef?.(result)
  }

  const handleCancel = () => {
    const resolveRef = useTransferConflictStore.getState()._resolveRef
    useTransferConflictStore.getState().clearAll()
    resolveRef?.(null)
  }

  if (!dialogOpen) return null

  return (
    <GlassDialog open={dialogOpen} onClose={handleCancel} width={700} height={550}>
      <div className="flex flex-col h-125.5 w-full overflow-hidden">
        <div className="flex items-center mb-4">
          <h2 className="text-base font-semibold text-text">{t('transfer.conflict.title')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-bg rounded-md border border-border min-h-10">
          {conflicts.map((conflict, index) => {
            const resolution = resolutions[index] ?? {
              localPath: conflict.localPath,
              itemName: conflict.itemName,
              strategy: CONFLICT_STRATEGY.KEEP_BOTH,
            }
            const cannotOverwrite = !canOverwrite(conflict)
            const sourceType = toFileType(conflict.itemType)
            const targetType = toFileTypeFromString(conflict.remoteFileType)

            return (
              <div key={conflict.localPath} className="p-3 bg-hover rounded-md mb-2">
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

                  <svg
                    className="w-4 h-4 stroke-text-muted stroke-2"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
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

                <div className="flex gap-4 justify-end">
                  <RadioButton
                    label={t('transfer.conflict.skip')}
                    name={`strategy-${index}`}
                    checked={resolution.strategy === CONFLICT_STRATEGY.SKIP}
                    onChange={() => handleStrategyChange(index, CONFLICT_STRATEGY.SKIP)}
                  />
                  <RadioButton
                    label={t('transfer.conflict.keepBoth')}
                    labelClassName="text-accent"
                    name={`strategy-${index}`}
                    checked={resolution.strategy === CONFLICT_STRATEGY.KEEP_BOTH}
                    onChange={() => handleStrategyChange(index, CONFLICT_STRATEGY.KEEP_BOTH)}
                  />
                  <RadioButton
                    label={t('transfer.conflict.overwrite')}
                    labelClassName={`text-danger ${cannotOverwrite ? 'cursor-not-allowed opacity-50' : ''}`}
                    name={`strategy-${index}`}
                    checked={resolution.strategy === CONFLICT_STRATEGY.OVERWRITE}
                    onChange={() =>
                      !cannotOverwrite && handleStrategyChange(index, CONFLICT_STRATEGY.OVERWRITE)
                    }
                    disabled={cannotOverwrite}
                  />
                </div>

                {cannotOverwrite && (
                  <div className="mt-2 text-xs text-danger">
                    {t('transfer.conflict.cannotOverwrite')}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-border shrink-0">
          <Checkbox
            checked={applyToAll}
            onChange={e => setApplyToAll(e.target.checked)}
            label={t('transfer.conflict.applyToAll')}
          />

          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={handleCancel}>
              {t('action.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t('action.confirm')}
            </Button>
          </div>
        </div>

        {applyToAll && (
          <div className="mt-2 p-2 bg-hover rounded flex items-center gap-4 shrink-0">
            <span className="text-xs text-text-muted">{t('transfer.conflict.globalAction')}:</span>
            <RadioButton
              label={t('transfer.conflict.skip')}
              name="global-strategy"
              checked={globalStrategy === CONFLICT_STRATEGY.SKIP}
              onChange={() => {
                setGlobalStrategy(CONFLICT_STRATEGY.SKIP)
                setResolutions(prev => prev.map(r => ({ ...r, strategy: CONFLICT_STRATEGY.SKIP })))
              }}
            />
            <RadioButton
              label={t('transfer.conflict.keepBoth')}
              labelClassName="text-accent"
              name="global-strategy"
              checked={globalStrategy === CONFLICT_STRATEGY.KEEP_BOTH}
              onChange={() => {
                setGlobalStrategy(CONFLICT_STRATEGY.KEEP_BOTH)
                setResolutions(prev =>
                  prev.map(r => ({ ...r, strategy: CONFLICT_STRATEGY.KEEP_BOTH }))
                )
              }}
            />
            <RadioButton
              label={t('transfer.conflict.overwrite')}
              labelClassName="text-danger"
              name="global-strategy"
              checked={globalStrategy === CONFLICT_STRATEGY.OVERWRITE}
              onChange={() => {
                setGlobalStrategy(CONFLICT_STRATEGY.OVERWRITE)
                setResolutions(prev =>
                  prev.map(r => ({ ...r, strategy: CONFLICT_STRATEGY.OVERWRITE }))
                )
              }}
            />
          </div>
        )}
      </div>
    </GlassDialog>
  )
}

export default TransferConflictDialog
