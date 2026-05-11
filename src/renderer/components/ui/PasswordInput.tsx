import React, { useState } from 'react'
import Input from './Input.js'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export const PasswordInput: React.FC<PasswordInputProps> = ({
  value,
  onChange,
  placeholder = '',
  className = '',
}) => {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="relative flex items-center">
      <Input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className} pr-10`}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className={`
          absolute right-2.5 bg-transparent border-none
          cursor-pointer p-1 flex items-center justify-center
          text-text-muted hover:text-text transition-colors
        `}
      >
        {showPassword ? (
          <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}

export default PasswordInput
