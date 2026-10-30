import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { useFileListState } from './use-file-list-state.js'

const file: FileInfo = {
  name: 'a.txt',
  type: 'file',
  size: 1,
  modifyTime: 0,
  absolutePath: '/a.txt',
}

describe('useFileListState', () => {
  it('重命名对话框记录目标文件并在关闭时清空', () => {
    const { result } = renderHook(() => useFileListState())

    act(() => result.current.openRenameDialog(file))
    expect(result.current.renameDialogOpen).toBe(true)
    expect(result.current.renameTarget).toEqual(file)

    act(() => result.current.closeRenameDialog())
    expect(result.current.renameDialogOpen).toBe(false)
    expect(result.current.renameTarget).toBeNull()
  })

  it('删除对话框记录文件集合', () => {
    const { result } = renderHook(() => useFileListState())

    act(() => result.current.openDeleteDialog([file]))
    expect(result.current.fileToDelete).toEqual([file])

    act(() => result.current.closeDeleteDialog())
    expect(result.current.fileToDelete).toBeNull()
  })

  it('右键菜单保存文件与是否空白区', () => {
    const { result } = renderHook(() => useFileListState())

    act(() => result.current.openContextMenu([file], false))
    expect(result.current.contextMenu).toEqual({ files: [file], isEmptyArea: false })

    act(() => result.current.closeContextMenu())
    expect(result.current.contextMenu).toBeNull()
  })
})
