import type { RefObject } from 'react'
import { useEffect } from 'react'

interface UseClickOutsideOptions {
  ref: RefObject<HTMLElement | null>
  enabled?: boolean
  event?: 'mousedown' | 'click'
  includeEscape?: boolean
  onOutside: () => void
}

export function useClickOutside({
  ref,
  enabled = true,
  event = 'mousedown',
  includeEscape = true,
  onOutside,
}: UseClickOutsideOptions): void {
  useEffect(() => {
    if (!enabled) return

    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOutside()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (includeEscape && e.key === 'Escape') {
        onOutside()
      }
    }

    document.addEventListener(event, handleClickOutside)
    if (includeEscape) {
      document.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      document.removeEventListener(event, handleClickOutside)
      if (includeEscape) {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [enabled, event, includeEscape, onOutside, ref])
}
