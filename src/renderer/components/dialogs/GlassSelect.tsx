import React, { useState, useRef, useEffect } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface GlassSelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
}

export const GlassSelect: React.FC<GlassSelectProps> = ({
  value,
  onChange,
  options,
  className = '',
}) => {
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
      onChange(options[highlightedIndex].value)
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
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%' }}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={className}
        style={{
          width: '100%',
          padding: '8px 12px',
          paddingRight: '32px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          color: 'var(--text)',
          fontSize: '13px',
          cursor: 'pointer',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'border-color 0.15s, box-shadow 0.15s',
          position: 'relative',
          margin: 0,
        }}
        onMouseEnter={e => {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--text-muted)'
        }}
        onMouseLeave={e => {
          ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'
        }}
      >
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          {selectedOption?.label || 'Select...'}
        </span>
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
          style={{
            position: 'absolute',
            top: 'calc(100% + 1px)',
            left: 0,
            right: 0,
            padding: '4px 0',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            listStyle: 'none',
            zIndex: 100,
            maxHeight: '200px',
            overflowY: 'auto',
            boxSizing: 'border-box',
          }}
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                backgroundColor: highlightedIndex === index ? 'var(--hover)' : 'transparent',
                color: option.value === value ? 'var(--accent)' : 'var(--text)',
                fontWeight: option.value === value ? 500 : 400,
                transition: 'background-color 0.1s',
              }}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default GlassSelect
