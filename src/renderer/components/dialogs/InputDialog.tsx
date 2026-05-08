import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import GlassDialog from './GlassDialog'

interface InputDialogProps {
  open: boolean
  onClose: () => void
  onSubmit: (value: string) => void
  title: string
  placeholder?: string
  defaultValue?: string
  submitText?: string
}

export const InputDialog: React.FC<InputDialogProps> = ({
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

  React.useEffect(() => {
    if (open) {
      setValue(defaultValue)
    }
  }, [open, defaultValue])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (value.trim()) {
      onSubmit(value.trim())
      onClose()
    }
  }

  return (
    <GlassDialog open={open} onClose={onClose}>
      <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)', marginBottom: '16px' }}>
        {title}
      </h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder={placeholder}
          autoFocus
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            color: 'var(--text)',
            fontSize: '14px',
            marginBottom: '16px',
            transition: 'border-color 0.15s, box-shadow 0.15s',
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = 'var(--accent)'
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.2)'
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = 'var(--border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {t('dialog.cancel')}
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: value.trim() ? 'var(--accent)' : 'var(--text-muted)',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              border: 'none',
              cursor: value.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {submitText || t('dialog.ok')}
          </button>
        </div>
      </form>
    </GlassDialog>
  )
}

export default InputDialog
