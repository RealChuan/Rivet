import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type FileInfo } from '@shared/types/index.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import Button from '@renderer/components/ui/Button.js'
import RadioButton from '@renderer/components/ui/RadioButton.js'
import { Checkbox } from '@renderer/components/ui/Checkbox.js'
import FileIcon from '@renderer/components/common/FileIcon.js'
import { logger } from '@renderer/utils/index.js'
import { FILE_OPERATIONS } from '@shared/constants/index.js'

export type ConflictStrategy = 'overwrite' | 'skip' | 'keepBoth'

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

type CopyMoveOperation = typeof FILE_OPERATIONS.COPY | typeof FILE_OPERATIONS.MOVE

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
  const [resolutions, setResolutions] = useState<ConflictResolution[]>([])
  const [applyToAll, setApplyToAll] = useState(false)
  const [globalStrategy, setGlobalStrategy] = useState<ConflictStrategy>('keepBoth')

  React.useEffect(() => {}, [])

  React.useEffect(() => {
    if (open && conflicts.length > 0) {
      const defaultStrategy: ConflictStrategy = 'keepBoth'
      const initialResolutions: ConflictResolution[] = conflicts.map(c => ({
        sourceFile: c.sourceFile,
        targetFile: c.targetFile ?? c.sourceFile,
        strategy: defaultStrategy,
      }))
      setResolutions(initialResolutions)
      setApplyToAll(false)
    }
  }, [open, conflicts, operation])

  const handleStrategyChange = (index: number, strategy: ConflictStrategy) => {
    if (applyToAll) {
      const newResolutions = resolutions.map(r => ({ ...r, strategy }))
      setResolutions(newResolutions)
      setGlobalStrategy(strategy)
    } else {
      const newResolutions = [...resolutions]
      const current = newResolutions[index]
      if (current) {
        newResolutions[index] = { ...current, strategy }
        setResolutions(newResolutions)
      }
    }
  }

  const handleConfirm = () => {
    logger.info('[Copy] ConflictDialog handleConfirm called')
    if (onConfirm) {
      void onConfirm(resolutions, operation, files, targetDir)
    }
    onClose()
  }

  const canOverwrite = (conflict: ConflictItem): boolean => {
    const sourceType = conflict.sourceFile.type
    const targetType = conflict.targetFile?.type

    if (!targetType) return true

    if (sourceType === targetType) return true

    return false
  }

  if (!open) return null

  return (
    <GlassDialog open={open} onClose={onClose} width={700} height={550}>
      <div className="flex flex-col h-125.5 w-full overflow-hidden">
        <div className="flex items-center mb-4">
          <h2 className="text-base font-semibold text-text">{t('file.conflict.title')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-background rounded-md border border-border min-h-10">
          {conflicts.map((conflict, index) => {
            const resolution = resolutions[index] ?? {
              sourceFile: conflict.sourceFile,
              targetFile: conflict.targetFile ?? conflict.sourceFile,
              strategy: 'overwrite' as const,
            }
            const cannotOverwrite = !canOverwrite(conflict)

            return (
              <div key={conflict.sourceFile.absolutePath} className="p-3 bg-hover rounded-md mb-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileIcon type={conflict.sourceFile.type} />
                      <span className="text-sm text-text font-medium">
                        {conflict.sourceFile.name}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {t('file.conflict.source')}: {conflict.sourceFile.absolutePath}
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
                      <FileIcon type={conflict.targetFile?.type ?? conflict.sourceFile.type} />
                      <span className="text-sm text-danger font-medium">
                        {conflict.targetFile?.name ?? conflict.sourceFile.name}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {t('file.conflict.target')}:{' '}
                      {conflict.targetFile?.absolutePath ?? conflict.sourceFile.absolutePath}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-end">
                  <RadioButton
                    label={t('file.conflict.skip')}
                    name={`strategy-${index}`}
                    checked={resolution.strategy === 'skip'}
                    onChange={() => handleStrategyChange(index, 'skip')}
                  />
                  <RadioButton
                    label={t('file.conflict.keepBoth')}
                    labelClassName="text-accent"
                    name={`strategy-${index}`}
                    checked={resolution.strategy === 'keepBoth'}
                    onChange={() => handleStrategyChange(index, 'keepBoth')}
                  />
                  {operation !== FILE_OPERATIONS.MOVE && (
                    <RadioButton
                      label={t('file.conflict.overwrite')}
                      labelClassName={`text-danger ${cannotOverwrite ? 'cursor-not-allowed opacity-50' : ''}`}
                      name={`strategy-${index}`}
                      checked={resolution.strategy === 'overwrite'}
                      onChange={() => !cannotOverwrite && handleStrategyChange(index, 'overwrite')}
                      disabled={cannotOverwrite}
                    />
                  )}
                </div>

                {cannotOverwrite && operation !== FILE_OPERATIONS.MOVE && (
                  <div className="mt-2 text-xs text-danger">
                    {t('file.conflict.cannotOverwrite')}
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
            label={t('file.conflict.applyToAll')}
          />

          <div className="flex gap-2.5">
            <Button
              variant="secondary"
              onClick={() => {
                setResolutions([])
                onClose()
              }}
            >
              {t('action.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t('action.confirm')}
            </Button>
          </div>
        </div>

        {applyToAll && (
          <div className="mt-2 p-2 bg-hover rounded flex items-center gap-4 shrink-0">
            <span className="text-xs text-text-muted">{t('file.conflict.globalAction')}:</span>
            <RadioButton
              label={t('file.conflict.skip')}
              name="global-strategy"
              checked={globalStrategy === 'skip'}
              onChange={() => {
                setGlobalStrategy('skip')
                setResolutions(resolutions.map(r => ({ ...r, strategy: 'skip' })))
              }}
            />
            <RadioButton
              label={t('file.conflict.keepBoth')}
              labelClassName="text-accent"
              name="global-strategy"
              checked={globalStrategy === 'keepBoth'}
              onChange={() => {
                setGlobalStrategy('keepBoth')
                setResolutions(resolutions.map(r => ({ ...r, strategy: 'keepBoth' })))
              }}
            />
            {operation !== FILE_OPERATIONS.MOVE && (
              <RadioButton
                label={t('file.conflict.overwrite')}
                labelClassName="text-danger"
                name="global-strategy"
                checked={globalStrategy === 'overwrite'}
                onChange={() => {
                  setGlobalStrategy('overwrite')
                  setResolutions(resolutions.map(r => ({ ...r, strategy: 'overwrite' })))
                }}
              />
            )}
          </div>
        )}
      </div>
    </GlassDialog>
  )
}

export default ConflictDialog
