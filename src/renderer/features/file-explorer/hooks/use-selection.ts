import { useCallback, useState } from 'react'
import type { FileInfo } from '@shared/types/index.js'

export interface SelectionModifiers {
  ctrl: boolean
  shift: boolean
}

export interface SelectionModel {
  selectedPaths: ReadonlySet<string>
  anchorPath: string | null
  focusedPath: string | null
  selectedEntries: FileInfo[]
  isSelected: (path: string) => boolean
  select: (path: string, modifiers: SelectionModifiers) => void
  replace: (paths: readonly string[]) => void
  selectAll: () => void
  clear: () => void
  moveFocus: (delta: number) => void
  focus: (path: string) => void
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** 选择模型只认 `absolutePath`，与列表/宫格布局无关。 */
export function useSelection(entries: FileInfo[]): SelectionModel {
  const [selectedPaths, setSelectedPaths] = useState<ReadonlySet<string>>(() => new Set())
  const [anchorPath, setAnchorPath] = useState<string | null>(null)
  const [focusedPath, setFocusedPath] = useState<string | null>(null)

  const select = useCallback(
    (path: string, modifiers: SelectionModifiers) => {
      setFocusedPath(path)

      if (modifiers.shift && anchorPath) {
        const from = entries.findIndex((entry) => entry.absolutePath === anchorPath)
        const to = entries.findIndex((entry) => entry.absolutePath === path)
        if (from === -1 || to === -1) {
          setSelectedPaths(new Set([path]))
          return
        }
        const start = Math.min(from, to)
        const end = Math.max(from, to)
        setSelectedPaths(new Set(entries.slice(start, end + 1).map((e) => e.absolutePath)))
        return
      }

      if (modifiers.ctrl) {
        setSelectedPaths((prev) => {
          const next = new Set(prev)
          if (next.has(path)) next.delete(path)
          else next.add(path)
          return next
        })
        setAnchorPath(path)
        return
      }

      setSelectedPaths(new Set([path]))
      setAnchorPath(path)
    },
    [anchorPath, entries],
  )

  const replace = useCallback((paths: readonly string[]) => {
    setSelectedPaths(new Set(paths))
    setAnchorPath(paths[0] ?? null)
    setFocusedPath(paths[paths.length - 1] ?? null)
  }, [])

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(entries.map((entry) => entry.absolutePath)))
    setAnchorPath(entries[0]?.absolutePath ?? null)
    setFocusedPath(entries[entries.length - 1]?.absolutePath ?? null)
  }, [entries])

  const clear = useCallback(() => {
    setSelectedPaths(new Set())
    setAnchorPath(null)
    setFocusedPath(null)
  }, [])

  const moveFocus = useCallback(
    (delta: number) => {
      if (delta === 0 || entries.length === 0) return
      const currentIndex = focusedPath
        ? entries.findIndex((entry) => entry.absolutePath === focusedPath)
        : 0
      const nextIndex = clamp(
        (currentIndex === -1 ? 0 : currentIndex) + delta,
        0,
        entries.length - 1,
      )
      const nextPath = entries[nextIndex]?.absolutePath
      if (!nextPath) return
      setSelectedPaths(new Set([nextPath]))
      setAnchorPath(nextPath)
      setFocusedPath(nextPath)
    },
    [entries, focusedPath],
  )

  const focus = useCallback((path: string) => {
    setFocusedPath(path)
  }, [])

  const isSelected = useCallback((path: string) => selectedPaths.has(path), [selectedPaths])

  return {
    selectedPaths,
    anchorPath,
    focusedPath,
    selectedEntries: entries.filter((entry) => selectedPaths.has(entry.absolutePath)),
    isSelected,
    select,
    replace,
    selectAll,
    clear,
    moveFocus,
    focus,
  }
}
