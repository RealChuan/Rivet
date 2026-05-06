import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { SORT_ORDER } from '@shared/constants/sort.js'
import { useFileSort } from './use-file-sort.js'

const mockFiles: FileInfo[] = [
  {
    name: 'b-file.txt',
    type: 'file',
    size: 200,
    modifyTime: 2000,
    permissions: 'rw-r--r--',
    owner: 'user1',
    absolutePath: '/b-file.txt',
  },
  {
    name: 'a-dir',
    type: 'directory',
    size: 0,
    modifyTime: 1000,
    permissions: 'rwxr-xr-x',
    owner: 'user2',
    absolutePath: '/a-dir',
  },
  {
    name: 'c-file.txt',
    type: 'file',
    size: 100,
    modifyTime: 3000,
    permissions: 'rw-------',
    owner: 'user1',
    absolutePath: '/c-file.txt',
  },
]

describe('useFileSort', () => {
  it('should sort directories before files', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    const firstFile = result.current.sortedFiles[0]
    if (!firstFile) throw new Error('Expected at least 1 file')
    expect(firstFile.name).toBe('a-dir')
  })

  it('should sort by name ascending by default', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    const fileNames = result.current.sortedFiles.filter((f) => f.type === 'file').map((f) => f.name)
    expect(fileNames).toEqual(['b-file.txt', 'c-file.txt'])
  })

  it('should toggle sort order when clicking same column', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    act(() => {
      result.current.handleSort('name')
    })
    expect(result.current.sortOrder).toBe(SORT_ORDER.DESC)
    act(() => {
      result.current.handleSort('name')
    })
    expect(result.current.sortOrder).toBe(SORT_ORDER.ASC)
  })

  it('should reset to asc when clicking different column', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    act(() => {
      result.current.handleSort('name')
    })
    expect(result.current.sortOrder).toBe(SORT_ORDER.DESC)
    act(() => {
      result.current.handleSort('size')
    })
    expect(result.current.sortBy).toBe('size')
    expect(result.current.sortOrder).toBe(SORT_ORDER.ASC)
  })

  it('should sort by size', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    act(() => {
      result.current.handleSort('size')
    })
    const files = result.current.sortedFiles.filter((f) => f.type === 'file')
    const firstFile = files[0]
    const secondFile = files[1]
    if (!firstFile || !secondFile) throw new Error('Expected at least 2 files')
    expect(firstFile.size).toBeLessThanOrEqual(secondFile.size)
  })

  it('should sort by modifyTime', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    act(() => {
      result.current.handleSort('modifyTime')
    })
    const files = result.current.sortedFiles.filter((f) => f.type === 'file')
    const firstFile = files[0]
    const secondFile = files[1]
    if (!firstFile || !secondFile) throw new Error('Expected at least 2 files')
    expect(firstFile.modifyTime).toBeLessThanOrEqual(secondFile.modifyTime)
  })

  it('should sort by permissions', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    act(() => {
      result.current.handleSort('permissions')
    })
    expect(result.current.sortBy).toBe('permissions')
  })

  it('should sort by owner', () => {
    const { result } = renderHook(() => useFileSort(mockFiles))
    act(() => {
      result.current.handleSort('owner')
    })
    expect(result.current.sortBy).toBe('owner')
  })

  it('should return empty array for empty input', () => {
    const { result } = renderHook(() => useFileSort([]))
    expect(result.current.sortedFiles).toEqual([])
  })
})
