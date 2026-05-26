import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFileDragSelect } from './useFileDragSelect.js'
import type { FileInfo } from '@shared/types/index.js'

const mockFiles: FileInfo[] = [
  {
    name: 'file1.txt',
    type: 'file',
    size: 100,
    modifyTime: 1000,
    absolutePath: '/file1.txt',
  },
  {
    name: 'file2.txt',
    type: 'file',
    size: 200,
    modifyTime: 2000,
    absolutePath: '/file2.txt',
  },
  {
    name: 'file3.txt',
    type: 'file',
    size: 300,
    modifyTime: 3000,
    absolutePath: '/file3.txt',
  },
]

function createMockContainerRef() {
  const mockGetBoundingClientRect = vi.fn(() => ({
    left: 0,
    top: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
  }))
  return {
    current: {
      getBoundingClientRect: mockGetBoundingClientRect,
      scrollLeft: 0,
      scrollTop: 0,
    } as unknown as HTMLDivElement,
    mockGetBoundingClientRect,
  }
}

function createMouseEvent(props: Partial<React.MouseEvent> = {}): React.MouseEvent {
  return {
    button: 0,
    clientX: 0,
    clientY: 0,
    target: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    ...props,
  } as unknown as React.MouseEvent
}

function dispatchMouseEvent(type: string, props: Record<string, unknown> = {}) {
  const event = new MouseEvent(type, { bubbles: true, ...props })
  document.dispatchEvent(event)
}

describe('useFileDragSelect', () => {
  let mockContainerRef: ReturnType<typeof createMockContainerRef>
  let onDragSelect: Mock<(files: FileInfo[]) => void>

  beforeEach(() => {
    mockContainerRef = createMockContainerRef()
    onDragSelect = vi.fn<(files: FileInfo[]) => void>()
  })

  it('should have correct initial state', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasStartedDrag).toBe(false)
    expect(result.current.dragSelection).toEqual(new Set())
  })

  it('should set isDragging=true on left button mousedown', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 50 }))
    })

    expect(result.current.isDragging).toBe(true)
  })

  it('should not start drag on non-left button', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ button: 1, clientX: 100, clientY: 50 }))
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('should not start drag when clicking a button element', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    const buttonEl = document.createElement('button')
    act(() => {
      result.current.handleMouseDown(
        createMouseEvent({ clientX: 100, clientY: 50, target: buttonEl })
      )
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('should not start drag when containerRef has no rect', () => {
    const nullRef = { current: null } as React.RefObject<HTMLDivElement | null>

    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: nullRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 50 }))
    })

    expect(result.current.isDragging).toBe(false)
  })

  it('should return correct drag style from getDragStyle', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 50 }))
    })

    // Simulate mouse move to (200, 150)
    act(() => {
      dispatchMouseEvent('mousemove', { clientX: 200, clientY: 150 })
    })

    const style = result.current.getDragStyle()
    // dragStart: (100, 50), dragEnd: (200, 150)
    expect(style.left).toBe(100)
    expect(style.top).toBe(50)
    expect(style.width).toBe(100)
    expect(style.height).toBe(100)
  })

  it('should not set hasStartedDrag when drag distance < 5px', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 50 }))
    })

    // Move only 3px
    act(() => {
      dispatchMouseEvent('mousemove', { clientX: 103, clientY: 50 })
    })

    expect(result.current.hasStartedDrag).toBe(false)
  })

  it('should set hasStartedDrag and update dragSelection when drag distance >= 5px', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 0 }))
    })

    // Move 50px down, covering rows 0-1 (y: 0 to 50, itemHeight: 30)
    act(() => {
      dispatchMouseEvent('mousemove', { clientX: 100, clientY: 50 })
    })

    expect(result.current.hasStartedDrag).toBe(true)
    // startIndex = floor(0/30) = 0, endIndex = ceil(50/30) = 2
    // So rows 0 and 1 are selected: file1.txt, file2.txt
    expect(result.current.dragSelection).toEqual(new Set(['file1.txt', 'file2.txt']))
  })

  it('should calculate selected file rows by y / itemHeight', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    // Start at y=35 (row 1), drag to y=85 (row 2-3 boundary)
    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 35 }))
    })

    act(() => {
      dispatchMouseEvent('mousemove', { clientX: 100, clientY: 85 })
    })

    // startY = min(35, 85) = 35, endY = max(35, 85) = 85
    // startIndex = floor(35/30) = 1, endIndex = ceil(85/30) = 3
    // Rows 1 and 2: file2.txt, file3.txt
    expect(result.current.dragSelection).toEqual(new Set(['file2.txt', 'file3.txt']))
  })

  it('should trigger onDragSelect callback on mouseup', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 0 }))
    })

    act(() => {
      dispatchMouseEvent('mousemove', { clientX: 100, clientY: 50 })
    })

    act(() => {
      dispatchMouseEvent('mouseup')
    })

    expect(onDragSelect).toHaveBeenCalledOnce()
    const callArgs = onDragSelect.mock.calls[0]
    if (!callArgs) throw new Error('Expected onDragSelect to be called with args')
    const firstArg: FileInfo[] = callArgs[0]
    if (!firstArg) throw new Error('Expected first argument')
    const names = firstArg.map(f => f.name)
    expect(names).toEqual(['file1.txt', 'file2.txt'])
  })

  it('should clear isDragging and hasStartedDrag on mouseup', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 0 }))
    })

    act(() => {
      dispatchMouseEvent('mousemove', { clientX: 100, clientY: 50 })
    })

    act(() => {
      dispatchMouseEvent('mouseup')
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasStartedDrag).toBe(false)
  })

  it('should only clear isDragging on mouseup without hasStartedDrag', () => {
    const { result } = renderHook(() =>
      useFileDragSelect({
        items: mockFiles,
        itemHeight: 30,
        containerRef: mockContainerRef,
        onDragSelect,
      })
    )

    act(() => {
      result.current.handleMouseDown(createMouseEvent({ clientX: 100, clientY: 50 }))
    })

    // Move less than 5px so hasStartedDrag stays false
    act(() => {
      dispatchMouseEvent('mousemove', { clientX: 102, clientY: 50 })
    })

    expect(result.current.hasStartedDrag).toBe(false)

    act(() => {
      dispatchMouseEvent('mouseup')
    })

    expect(result.current.isDragging).toBe(false)
    expect(result.current.hasStartedDrag).toBe(false)
    expect(onDragSelect).not.toHaveBeenCalled()
  })
})
