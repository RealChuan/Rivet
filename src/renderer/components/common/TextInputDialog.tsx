import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button.js'
import { GlassDialog } from '../ui/index.js'

interface TextInputDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  placeholder?: string
  defaultValue?: string
  submitText?: string
}

export const TextInputDialog: React.FC<TextInputDialogProps> = ({
  open,
  onClose,
  onSubmit,
  title,
  placeholder,
  defaultValue = '',
  submitText,
}) => {
  const { t } = useTranslation()
  const [value, setValue] = useState(defaultValue)
  const [prevOpen, setPrevOpen] = useState(open)
  if (open && open !== prevOpen) {
    setValue(defaultValue)
    setPrevOpen(open)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
      onClose()
    }
  }

  return (
    <GlassDialog open={open} onClose={onClose}>
      <h2 className="text-base font-semibold text-text mb-4">{title}</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className={`
            w-full px-3 py-2.5 bg-bg border border-border rounded-md
            text-text text-sm mb-4 transition-all duration-150
            focus:border-accent focus:ring-2 focus:ring-ring
            outline-none
          `}
        />
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.action.cancel')}
          </Button>
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            {submitText ?? t('common.action.confirm')}
          </Button>
        </div>
      </form>
    </GlassDialog>
  )
}

export default TextInputDialog
