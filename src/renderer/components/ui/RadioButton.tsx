import React from 'react'

interface RadioButtonProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  labelClassName?: string
}

export const RadioButton: React.FC<RadioButtonProps> = ({
  label,
  labelClassName = 'text-text',
  className = '',
  ...props
}) => {
  return (
    <label className={`flex items-center gap-1.5 cursor-pointer ${labelClassName}`}>
      <input
        type="radio"
        className={`w-3.5 h-3.5 outline-none focus:outline-none focus:ring-0 ${className}`}
        {...props}
      />
      <span className="text-xs">{label}</span>
    </label>
  )
}

export default RadioButton
