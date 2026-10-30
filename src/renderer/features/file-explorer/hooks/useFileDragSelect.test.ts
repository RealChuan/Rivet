import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import { useFileDragSelect } from './use-file-drag-select.js'

const files: FileInfo[] = Array.from({ length: 6 }, (_, index) => ({
  name: `f${index}`,
  type: 'file',
  size: 1,
  modifyTime: 0,
  absolutePath: `/f${index}`,
}))

function createContainer() {
  return {
    current: {
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600,
        width: 800,
        height: 600,
      })),
      scrollLeft: 0,
      scrollTop: 0,
      clientHeight: 600,
    } as unknown as HTMLElement,
  }
}

function mouseDownEvent(clientX: number, clientY: number): React.MouseEvent {
  return {
    button: 0,
    clientX,
    clientY,
    target: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.MouseEvent
}

function dispatchMouse(type: string, clientX: number, clientY: number) {
  document.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }))
}

describe('useFileDragSelect', () => {
  let scrollContainerRef: ReturnType<typeof createContainer>
  let onDragSelect: Mock<(paths: string[]) => void>

  beforeEach(() => {
    scrollContainerRef = createContainer()
    onDragSelect = vi.fn<(paths: string[]) => void>()
  })

  const renderDragSelect = (columns = 1, cellWidth = 800, rowHeight = 32) =>
    renderHook(() =>
      useFileDragSelect({
        entries: files,
        columns,
        cellWidth,
        rowHeight,
        scrollContainerRef,
        onDragSelect,
      }),
    )

  it('初始状态不在拖拽', () => {
    const { result } = renderDragSelect()

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasStartedDrag).toBe(false)
    expect(result.current.dragSelection).toEqual(new Set())
  })

  it('列表框选按行返回 absolutePath', () => {
    const { result } = renderDragSelect()

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 10)))
    act(() => dispatchMouse('mousemove', 10, 70))
    act(() => dispatchMouse('mouseup', 10, 70))

    expect(onDragSelect).toHaveBeenCalledWith(['/f0', '/f1', '/f2'])
  })

  it('宫格框选按列切分后返回跨行条目', () => {
    const { result } = renderDragSelect(3, 200, 100)

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 10)))
    act(() => dispatchMouse('mousemove', 450, 150))
    act(() => dispatchMouse('mouseup', 450, 150))

    expect(onDragSelect).toHaveBeenCalledWith(['/f0', '/f1', '/f2', '/f3', '/f4', '/f5'])
  })

  it('拖拽距离过小时不触发选择回调', () => {
    const { result } = renderDragSelect()

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 10)))
    act(() => dispatchMouse('mousemove', 11, 11))
    act(() => dispatchMouse('mouseup', 11, 11))

    expect(onDragSelect).not.toHaveBeenCalled()
  })
})
