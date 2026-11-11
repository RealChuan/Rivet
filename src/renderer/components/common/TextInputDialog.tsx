import type React from 'react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../../components/ui/Button.js'
import { DialogFooter, GlassDialog, Input } from '../ui/index.js'

interface TextInputDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  placeholder?: string
  defaultValue?: string
  submitText?: string
}

export const TextInputDialog = ({
  open,
  onClose,
  onSubmit,
  title,
  placeholder,
  defaultValue = '',
  submitText,
}: TextInputDialogProps) => {
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
        <Input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          className="mb-4"
        />
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(($) => $.common.action.cancel)}
          </Button>
          <Button type="submit" variant="primary" disabled={!value.trim()}>
            {submitText ?? t(($) => $.common.action.confirm)}
          </Button>
        </DialogFooter>
      </form>
    </GlassDialog>
  )
}

export default TextInputDialog
