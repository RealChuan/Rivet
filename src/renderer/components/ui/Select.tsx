import React, { useState, useRef, useEffect } from 'react'

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

export const Select: React.FC<SelectProps> = ({ value, onChange, options, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      setHighlightedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1))
    }
  }

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={handleKeyDown}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full px-3 pr-8 py-2 bg-bg border border-border rounded-md
          text-text text-left flex items-center justify-between relative cursor-pointer
          transition-colors duration-150 hover:border-text-muted focus:outline-none
          focus:ring-2 focus:ring-focus-ring text-[13px] box-border min-h-8.25 m-0
          ${className}
        `}
      >
        <span className="flex-1 truncate">{selectedOption?.label ?? 'Select...'}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            position: 'absolute',
            right: '10px',
            top: '50%',
            transform: `translateY(-50%) ${isOpen ? 'rotate(180deg)' : ''}`,
            transition: 'transform 0.15s',
            pointerEvents: 'none',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          className={`
            absolute top-full left-0 right-0 z-100 bg-bg border border-border
            rounded-md shadow-[0_4px_12px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.03)] list-none max-h-50 overflow-y-auto p-1 box-border mt-1
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
              className={`
                px-3 py-2 cursor-pointer transition-colors duration-100
                ${highlightedIndex === index ? 'bg-hover' : 'bg-transparent'}
                ${option.value === value ? 'text-accent font-medium' : 'text-text font-normal'}
              `}
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
