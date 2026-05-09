import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileInfo } from '@shared/types'
import GlassDialog from './GlassDialog'
import Button from '../ui/Button'
import RadioButton from '../ui/RadioButton'
import logger from '../../utils/logger'

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

interface ConflictDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (
    resolutions: ConflictResolution[],
    operation?: 'copy' | 'move',
    files?: FileInfo[],
    targetDir?: FileInfo | null
  ) => void | Promise<void>
  conflicts: ConflictItem[]
  operation?: 'copy' | 'move'
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
  const [globalStrategy, setGlobalStrategy] = useState<ConflictStrategy>(
    operation === 'move' ? 'keepBoth' : 'overwrite'
  )

  React.useEffect(() => {}, [])

  React.useEffect(() => {
    if (open && conflicts.length > 0) {
      const defaultStrategy: ConflictStrategy = operation === 'move' ? 'keepBoth' : 'overwrite'
      const initialResolutions: ConflictResolution[] = conflicts.map(c => ({
        sourceFile: c.sourceFile,
        targetFile: c.targetFile || c.sourceFile,
        strategy: defaultStrategy,
      }))
      setResolutions(initialResolutions)
      setApplyToAll(false)
    }
  }, [open, conflicts])

  const handleStrategyChange = (index: number, strategy: ConflictStrategy) => {
    if (applyToAll) {
      const newResolutions = resolutions.map(r => ({ ...r, strategy }))
      setResolutions(newResolutions)
      setGlobalStrategy(strategy)
    } else {
      const newResolutions = [...resolutions]
      newResolutions[index] = { ...newResolutions[index], strategy }
      setResolutions(newResolutions)
    }
  }

  const handleConfirm = async () => {
    logger.info('[Copy] ConflictDialog handleConfirm called')
    if (onConfirm) {
      await onConfirm(resolutions, operation, files, targetDir)
    }
    onClose()
  }

  const canOverwrite = (conflict: ConflictItem) => {
    return conflict.sourceFile.type === conflict.targetFile?.type
  }

  if (!open) return null

  return (
    <GlassDialog open={open} onClose={onClose} width={700} height={550}>
      <div className="flex flex-col h-125.5 w-full overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-text">{t('dialog.conflict.title')}</h2>
          <button
            onClick={onClose}
            className={`
              p-1 rounded bg-transparent border-none cursor-pointer
              text-text-muted hover:bg-hover transition-colors
            `}
          >
            <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-background rounded-md border border-border min-h-10">
          {conflicts.map((conflict, index) => {
            const resolution = resolutions[index] || {
              sourceFile: conflict.sourceFile,
              targetFile: conflict.targetFile || conflict.sourceFile,
              strategy: 'overwrite' as const,
            }
            const cannotOverwrite = !canOverwrite(conflict)

            return (
              <div key={conflict.sourceFile.absolutePath} className="p-3 bg-hover rounded-md mb-2">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-3.5 h-3.5">
                        {conflict.sourceFile.type === 'directory' ? (
                          <path
                            d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                            fill="var(--warning)"
                            stroke="none"
                          />
                        ) : (
                          <path
                            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-text-muted"
                          />
                        )}
                      </svg>
                      <span className="text-sm text-text font-medium">
                        {conflict.sourceFile.name}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {t('dialog.conflict.source')}: {conflict.sourceFile.absolutePath}
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
                      <svg className="w-3.5 h-3.5">
                        {conflict.targetFile?.type === 'directory' ? (
                          <path
                            d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                            fill="var(--warning)"
                            stroke="none"
                          />
                        ) : (
                          <path
                            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="text-text-muted"
                          />
                        )}
                      </svg>
                      <span className="text-sm text-danger font-medium">
                        {conflict.targetFile?.name || conflict.sourceFile.name}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted">
                      {t('dialog.conflict.target')}:{' '}
                      {conflict.targetFile?.absolutePath || conflict.sourceFile.absolutePath}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 justify-end">
                  <RadioButton
                    label={t('dialog.conflict.skip')}
                    name={`strategy-${index}`}
                    checked={resolution.strategy === 'skip'}
                    onChange={() => handleStrategyChange(index, 'skip')}
                  />
                  <RadioButton
                    label={t('dialog.conflict.keepBoth')}
                    labelClassName="text-accent"
                    name={`strategy-${index}`}
                    checked={resolution.strategy === 'keepBoth'}
                    onChange={() => handleStrategyChange(index, 'keepBoth')}
                  />
                  {operation !== 'move' && (
                    <RadioButton
                      label={t('dialog.conflict.overwrite')}
                      labelClassName={`text-[#f14c4c] ${cannotOverwrite ? 'cursor-not-allowed opacity-50' : ''}`}
                      name={`strategy-${index}`}
                      checked={resolution.strategy === 'overwrite'}
                      onChange={() => !cannotOverwrite && handleStrategyChange(index, 'overwrite')}
                      disabled={cannotOverwrite}
                    />
                  )}
                </div>

                {cannotOverwrite && operation !== 'move' && (
                  <div className="mt-2 text-xs text-danger">
                    {t('dialog.conflict.cannotOverwrite')}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-border shrink-0">
          <label className="flex items-center gap-2 text-xs text-text cursor-pointer">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={e => setApplyToAll(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            {t('dialog.conflict.applyToAll')}
          </label>

          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={onClose}>
              {t('dialog.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t('dialog.confirm')}
            </Button>
          </div>
        </div>

        {applyToAll && (
          <div className="mt-2 p-2 bg-hover rounded flex items-center gap-4 shrink-0">
            <span className="text-xs text-text-muted">{t('dialog.conflict.globalAction')}:</span>
            <RadioButton
              label={t('dialog.conflict.skip')}
              name="global-strategy"
              checked={globalStrategy === 'skip'}
              onChange={() => {
                setGlobalStrategy('skip')
                setResolutions(resolutions.map(r => ({ ...r, strategy: 'skip' })))
              }}
            />
            <RadioButton
              label={t('dialog.conflict.keepBoth')}
              labelClassName="text-accent"
              name="global-strategy"
              checked={globalStrategy === 'keepBoth'}
              onChange={() => {
                setGlobalStrategy('keepBoth')
                setResolutions(resolutions.map(r => ({ ...r, strategy: 'keepBoth' })))
              }}
            />
            {operation !== 'move' && (
              <RadioButton
                label={t('dialog.conflict.overwrite')}
                labelClassName="text-[#f14c4c]"
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
