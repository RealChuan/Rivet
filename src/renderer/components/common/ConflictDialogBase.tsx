import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import Button from '@renderer/components/ui/Button.js'
import { Checkbox } from '@renderer/components/ui/Checkbox.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import { RadioButton, RadioGroup } from '@renderer/components/ui/RadioButton.js'
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

export const ConflictDialogBase = ({
  open,
  onClose,
  onConfirm,
  conflictCount,
  hideOverwrite = false,
  canOverwrite,
  renderConflictInfo,
}: ConflictDialogBaseProps) => {
  const { t } = useTranslation()
  const [strategies, setStrategies] = useState<ConflictStrategy[]>(() =>
    Array.from({ length: conflictCount }, () => CONFLICT_STRATEGY.KEEP_BOTH),
  )
  const [applyToAll, setApplyToAll] = useState(false)
  const [globalStrategy, setGlobalStrategy] = useState<ConflictStrategy>(
    CONFLICT_STRATEGY.KEEP_BOTH,
  )

  const handleStrategyChange = (index: number, strategy: ConflictStrategy) => {
    if (applyToAll) {
      setStrategies((prev) => prev.map(() => strategy))
      setGlobalStrategy(strategy)
    } else {
      setStrategies((prev) => {
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
    setStrategies((prev) => prev.map(() => strategy))
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
          <h2 className="text-base font-semibold text-text">{t(($) => $.conflict.title)}</h2>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 bg-glass-bg rounded-md border border-border min-h-10">
          {Array.from({ length: conflictCount }, (_, index) => {
            const strategy = strategies[index] ?? CONFLICT_STRATEGY.KEEP_BOTH
            const cannotOverwrite = canOverwrite ? !canOverwrite(index) : false

            return (
              <div key={`conflict-${index}`} className="p-3 bg-hover rounded-md mb-2 min-w-0">
                <div className="min-w-0 wrap-break-word">{renderConflictInfo(index)}</div>

                <RadioGroup
                  value={strategy}
                  onValueChange={(val) => handleStrategyChange(index, val as ConflictStrategy)}
                  className="flex gap-4 justify-end"
                >
                  <RadioButton value={CONFLICT_STRATEGY.SKIP} label={t(($) => $.conflict.skip)} />
                  <RadioButton
                    value={CONFLICT_STRATEGY.KEEP_BOTH}
                    label={t(($) => $.conflict.keepBoth)}
                    labelClassName="text-accent"
                  />
                  {!hideOverwrite && (
                    <RadioButton
                      value={CONFLICT_STRATEGY.OVERWRITE}
                      label={t(($) => $.conflict.overwrite)}
                      labelClassName={cn(
                        'text-danger',
                        cannotOverwrite && 'cursor-not-allowed opacity-50',
                      )}
                      disabled={cannotOverwrite}
                    />
                  )}
                </RadioGroup>

                {cannotOverwrite && !hideOverwrite && (
                  <div className="mt-2 text-xs text-danger">
                    {t(($) => $.conflict.cannotOverwrite)}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="flex justify-between items-center mt-4 pt-3 border-t border-border shrink-0">
          <Checkbox
            checked={applyToAll}
            onChange={setApplyToAll}
            label={t(($) => $.conflict.applyToAll)}
          />

          <div className="flex gap-2.5">
            <Button variant="secondary" onClick={handleCancel}>
              {t(($) => $.common.action.cancel)}
            </Button>
            <Button variant="primary" onClick={handleConfirm}>
              {t(($) => $.common.action.confirm)}
            </Button>
          </div>
        </div>

        {applyToAll && (
          <div className="mt-2 p-2 bg-hover rounded flex items-center gap-4 shrink-0">
            <span className="text-xs text-text-muted">{t(($) => $.conflict.globalAction)}:</span>
            <RadioGroup
              value={globalStrategy}
              onValueChange={(val) => handleGlobalStrategyChange(val as ConflictStrategy)}
              className="flex items-center gap-4"
            >
              <RadioButton value={CONFLICT_STRATEGY.SKIP} label={t(($) => $.conflict.skip)} />
              <RadioButton
                value={CONFLICT_STRATEGY.KEEP_BOTH}
                label={t(($) => $.conflict.keepBoth)}
                labelClassName="text-accent"
              />
              {!hideOverwrite && (
                <RadioButton
                  value={CONFLICT_STRATEGY.OVERWRITE}
                  label={t(($) => $.conflict.overwrite)}
                  labelClassName="text-danger"
                />
              )}
            </RadioGroup>
          </div>
        )}
      </div>
    </GlassDialog>
  )
}

export default ConflictDialogBase
