import type React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@renderer/utils/index.js'
import Input from './Input.js'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const PasswordInput = ({
  value,
  onChange,
  placeholder = '',
  className,
}: PasswordInputProps) => {
  const [showPassword, setShowPassword] = useState(false)
  const { t } = useTranslation()

  return (
    <div className="relative flex items-center">
      <Input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(className, 'pr-10')}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        aria-label={
          showPassword
            ? t(($) => $.passwordInput.hidePassword)
            : t(($) => $.passwordInput.showPassword)
        }
        className={cn(
          'absolute right-2.5 bg-transparent border-none',
          'cursor-pointer p-1 flex items-center justify-center',
          'text-text-muted hover:text-text transition-colors',
          'focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
        )}
      >
        {showPassword ? (
          <EyeOff className="w-4 h-4 stroke-current stroke-2" />
        ) : (
          <Eye className="w-4 h-4 stroke-current stroke-2" />
        )}
      </button>
    </div>
  )
}

export default PasswordInput
