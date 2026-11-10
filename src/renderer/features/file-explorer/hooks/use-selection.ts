import { useCallback, useState } from 'react'
import type { FileInfo } from '@shared/types/index.js'

export interface SelectionModifiers {
  ctrl: boolean
  shift: boolean
}

export interface SelectionMoveOptions {
  /** Shift+方向键：从锚点扩展区间，锚点本身不动 */
  extend?: boolean
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
  moveFocus: (delta: number, options?: SelectionMoveOptions) => void
  focusEdge: (edge: 'start' | 'end', options?: SelectionMoveOptions) => void
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

  const applyFocus = useCallback(
    (nextIndex: number, extend: boolean) => {
      const nextPath = entries[nextIndex]?.absolutePath
      if (nextPath === undefined) return

      if (extend && anchorPath) {
        const anchorIndex = entries.findIndex((entry) => entry.absolutePath === anchorPath)
        const from = anchorIndex === -1 ? nextIndex : anchorIndex
        const start = Math.min(from, nextIndex)
        const end = Math.max(from, nextIndex)
        setSelectedPaths(new Set(entries.slice(start, end + 1).map((entry) => entry.absolutePath)))
      } else {
        setSelectedPaths(new Set([nextPath]))
        setAnchorPath(nextPath)
      }
      setFocusedPath(nextPath)
    },
    [anchorPath, entries],
  )

  const moveFocus = useCallback(
    (delta: number, options?: SelectionMoveOptions) => {
      if (delta === 0 || entries.length === 0) return
      // 没有焦点时把首次按键当作「选中第一项」，与资源管理器一致。
      const base = focusedPath
        ? entries.findIndex((entry) => entry.absolutePath === focusedPath)
        : -1
      applyFocus(clamp(base + delta, 0, entries.length - 1), options?.extend === true)
    },
    [applyFocus, entries, focusedPath],
  )

  const focusEdge = useCallback(
    (edge: 'start' | 'end', options?: SelectionMoveOptions) => {
      if (entries.length === 0) return
      applyFocus(edge === 'start' ? 0 : entries.length - 1, options?.extend === true)
    },
    [applyFocus, entries.length],
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
    focusEdge,
    focus,
  }
}
