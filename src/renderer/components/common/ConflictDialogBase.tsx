import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConflictAction } from '@shared/constants/index.js'
import { CONFLICT_ACTION, DIALOG_SIZE } from '@shared/constants/index.js'
import { cn } from '../../utils/index.js'
import Button from '../ui/Button.js'
import { Checkbox } from '../ui/Checkbox.js'
import GlassDialog from '../ui/GlassDialog.js'
import { RadioButton, RadioGroup } from '../ui/RadioButton.js'

interface ConflictDialogBaseProps {
  open: boolean
  onClose: () => void
  onConfirm: (strategies: ConflictAction[]) => void
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
  const [strategies, setStrategies] = useState<ConflictAction[]>(() =>
    Array.from({ length: conflictCount }, () => CONFLICT_ACTION.KEEP_BOTH),
  )
  const [applyToAll, setApplyToAll] = useState(false)
  const [globalStrategy, setGlobalStrategy] = useState<ConflictAction>(CONFLICT_ACTION.KEEP_BOTH)

  const handleStrategyChange = (index: number, strategy: ConflictAction) => {
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

  const handleGlobalStrategyChange = (strategy: ConflictAction) => {
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
            const strategy = strategies[index] ?? CONFLICT_ACTION.KEEP_BOTH
            const cannotOverwrite = canOverwrite ? !canOverwrite(index) : false

            return (
              <div key={`conflict-${index}`} className="p-3 bg-hover rounded-md mb-2 min-w-0">
                <div className="min-w-0 wrap-break-word">{renderConflictInfo(index)}</div>

                <RadioGroup
                  value={strategy}
                  onValueChange={(val) => handleStrategyChange(index, val as ConflictAction)}
                  className="flex gap-4 justify-end"
                >
                  <RadioButton value={CONFLICT_ACTION.SKIP} label={t(($) => $.conflict.skip)} />
                  <RadioButton
                    value={CONFLICT_ACTION.KEEP_BOTH}
                    label={t(($) => $.conflict.keepBoth)}
                    labelClassName="text-accent"
                  />
                  {!hideOverwrite && (
                    <RadioButton
                      value={CONFLICT_ACTION.OVERWRITE}
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
              onValueChange={(val) => handleGlobalStrategyChange(val as ConflictAction)}
              className="flex items-center gap-4"
            >
              <RadioButton value={CONFLICT_ACTION.SKIP} label={t(($) => $.conflict.skip)} />
              <RadioButton
                value={CONFLICT_ACTION.KEEP_BOTH}
                label={t(($) => $.conflict.keepBoth)}
                labelClassName="text-accent"
              />
              {!hideOverwrite && (
                <RadioButton
                  value={CONFLICT_ACTION.OVERWRITE}
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
