import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@renderer/components/ui/Button.js'
import { Checkbox } from '@renderer/components/ui/Checkbox.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import RadioButton from '@renderer/components/ui/RadioButton.js'
import { cn } from '@renderer/utils/index.js'
import { DIALOG_SIZE } from '@shared/constants/index.js'

export const CONFLICT_STRATEGY = {
  OVERWRITE: 'overwrite',
  SKIP: 'skip',
  KEEP_BOTH: 'keepBoth',
} as const

export type ConflictStrategy = (typeof CONFLICT_STRATEGY)[keyof typeof CONFLICT_STRATEGY]

interface ConflictDialogBaseProps {
  open: boolean
  onClose: () => void
  onConfirm: (strategies: ConflictStrategy[]) => void
  conflictCount: number
  hideOverwrite?: boolean
  canOverwrite?: (index: number) => boolean
  renderConflictInfo: (index: number) => React.ReactNode
}

export const ConflictDialogBase: React.FC<ConflictDialogBaseProps> = ({
  open,
  onClose,
  onConfirm,
  conflictCount,
  hideOverwrite = false,
  canOverwrite,
  renderConflictInfo,
}) => {
  const { t } = useTranslation()
  const [strategies, setStrategies] = useState<ConflictStrategy[]>([])
  const [applyToAll, setApplyToAll] = useState(false)
  const [globalStrategy, setGlobalStrategy] = useState<ConflictStrategy>(
    CONFLICT_STRATEGY.KEEP_BOTH
  )

  const [prevOpen, setPrevOpen] = useState(open)
  const [prevConflictCount, setPrevConflictCount] = useState(conflictCount)
  if (open && (open !== prevOpen || conflictCount !== prevConflictCount)) {
    setPrevOpen(open)
    setPrevConflictCount(conflictCount)
    setStrategies(Array.from({ length: conflictCount }, () => CONFLICT_STRATEGY.KEEP_BOTH))
    setApplyToAll(false)
    setGlobalStrategy(CONFLICT_STRATEGY.KEEP_BOTH)
  }

  const handleStrategyChange = (index: number, strategy: ConflictStrategy) => {
    if (applyToAll) {
      setStrategies(prev => prev.map(() => strategy))
      setGlobalStrategy(strategy)
    } else {
      setStrategies(prev => {
        const next = [...prev]
        next[index] = strategy
        return next
      })
    }
  }

  const handleConfirm = () => {
    onConfirm(strategies)
  }

  const handleCancel = () => {
    onClose()
  }

  const handleGlobalStrategyChange = (strategy: ConflictStrategy) => {
    setGlobalStrategy(strategy)
    setStrategies(prev => prev.map(() => strategy))
  }

  if (!open) return null

  return (
    <GlassDialog
      open={open}
      onClose={onClose}
      width={DIALOG_SIZE.EXTRA_LARGE.width}
      height={DIALOG_SIZE.EXTRA_LARGE.height}
    >
      <div className="flex flex-col h-125.5 w-full overflow-hidden">
        <div className="flex items-center mb-4">
          <h2 className="text-base font-semibold text-text">{t('conflict.title')}</h2>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-bg rounded-md border border-border min-h-10">
          {Array.from({ length: conflictCount }, (_, index) => {
            const strategy = strategies[index] ?? CONFLICT_STRATEGY.KEEP_BOTH
            const cannotOverwrite = canOverwrite ? !canOverwrite(index) : false

            // key=index: 冲突项无唯一标识，列表在对话框打开后为静态，顺序不变
            return (
              <div key={index} className="p-3 bg-hover rounded-md mb-2 min-w-0">
                <div className="min-w-0 wrap-break-word">{renderConflictInfo(index)}</div>

                <div className="flex gap-4 justify-end">
                  <RadioButton
                    label={t('conflict.skip')}
                    name={`strategy-${index}`}
                    checked={strategy === CONFLICT_STRATEGY.SKIP}
                    onChange={() => handleStrategyChange(index, CONFLICT_STRATEGY.SKIP)}
                  />
                  <RadioButton
                    label={t('conflict.keepBoth')}
                    labelClassName="text-accent"
                    name={`strategy-${index}`}
                    checked={strategy === CONFLICT_STRATEGY.KEEP_BOTH}
                    onChange={() => handleStrategyChange(index, CONFLICT_STRATEGY.KEEP_BOTH)}
                  />
                  {!hideOverwrite && (
                    <RadioButton
                      label={t('conflict.overwrite')}
                      labelClassName={cn(
                        'text-danger',
                        cannotOverwrite && 'cursor-not-allowed opacity-50'
                      )}
                      name={`strategy-${index}`}
                      checked={strategy === CONFLICT_STRATEGY.OVERWRITE}
                      onChange={() =>
                        !cannotOverwrite && handleStrategyChange(index, CONFLICT_STRATEGY.OVERWRITE)
                      }
                      disabled={cannotOverwrite}
                    />
                  )}
                </div>

                {cannotOverwrite && !hideOverwrite && (
                  <div className="mt-2 text-xs text-danger">{t('conflict.cannotOverwrite')}</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-border shrink-0">
          <Checkbox
            checked={applyToAll}
            onChange={e => setApplyToAll(e.target.checked)}
            label={t('conflict.applyToAll')}
          />

          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={handleCancel}>
              {t('common.action.cancel')}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t('common.action.confirm')}
            </Button>
          </div>
        </div>

        {applyToAll && (
          <div className="mt-2 p-2 bg-hover rounded flex items-center gap-4 shrink-0">
            <span className="text-xs text-text-muted">{t('conflict.globalAction')}:</span>
            <RadioButton
              label={t('conflict.skip')}
              name="global-strategy"
              checked={globalStrategy === CONFLICT_STRATEGY.SKIP}
              onChange={() => handleGlobalStrategyChange(CONFLICT_STRATEGY.SKIP)}
            />
            <RadioButton
              label={t('conflict.keepBoth')}
              labelClassName="text-accent"
              name="global-strategy"
              checked={globalStrategy === CONFLICT_STRATEGY.KEEP_BOTH}
              onChange={() => handleGlobalStrategyChange(CONFLICT_STRATEGY.KEEP_BOTH)}
            />
            {!hideOverwrite && (
              <RadioButton
                label={t('conflict.overwrite')}
                labelClassName="text-danger"
                name="global-strategy"
                checked={globalStrategy === CONFLICT_STRATEGY.OVERWRITE}
                onChange={() => handleGlobalStrategyChange(CONFLICT_STRATEGY.OVERWRITE)}
              />
            )}
          </div>
        )}
      </div>
    </GlassDialog>
  )
}

export default ConflictDialogBase
