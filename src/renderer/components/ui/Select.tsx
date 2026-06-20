import type React from 'react'
import { ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useClickOutside } from '@renderer/hooks/index.js'
import { cn } from '@renderer/utils/index.js'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
}

export const Select = ({ value, onChange, options, className = '' }: SelectProps) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find((opt) => opt.value === value)

  useClickOutside({
    ref: containerRef,
    includeEscape: false,
    onOutside: () => setIsOpen(false),
  })

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex, isOpen])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && highlightedIndex >= 0) {
      const selectedValue = options[highlightedIndex]?.value ?? options[0]?.value ?? ''
      onChange(selectedValue)
      setIsOpen(false)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1))
    }
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`} onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-3 pr-8 py-2 bg-glass-bg border border-border rounded-md
          text-text text-left flex items-center justify-between relative cursor-pointer
          transition-colors duration-150 hover:border-text-muted focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-ring text-[13px] box-border min-h-8.25 m-0
        `}
      >
        <span className="flex-1 truncate">
          {selectedOption?.label ?? t(($) => $.common.selectPlaceholder)}
        </span>
        <ChevronDown
          className={cn(
            'w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-150',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          className={`
            absolute top-full left-0 right-0 z-100 bg-glass-bg backdrop-blur-xl border border-border
            rounded-md shadow-dropdown list-none max-h-50 overflow-y-auto p-1 box-border mt-1
          `}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseLeave={() => setHighlightedIndex(-1)}
              className={cn(
                'px-3 py-2 cursor-pointer transition-colors duration-100',
                highlightedIndex === index ? 'bg-hover' : 'bg-transparent',
                option.value === value ? 'text-accent font-medium' : 'text-text font-normal',
              )}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default Select
