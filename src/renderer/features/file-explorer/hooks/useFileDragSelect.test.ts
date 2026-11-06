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
  isHidden: false,
}))

interface ContainerMetrics {
  scrollX?: number
  scrollY?: number
  /** 内容盒宽高，比 rect 小的部分即滚动条占位。 */
  clientWidth?: number
  clientHeight?: number
}

function createContainer({
  scrollX = 0,
  scrollY = 0,
  clientWidth = 800,
  clientHeight = 600,
}: ContainerMetrics = {}) {
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
      scrollLeft: scrollX,
      scrollTop: scrollY,
      clientLeft: 0,
      clientTop: 0,
      clientWidth,
      clientHeight,
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

interface RenderOptions {
  columns?: number
  cellWidth?: number
  rowHeight?: number
  onDragStart?: () => void
}

describe('useFileDragSelect', () => {
  let scrollContainerRef: ReturnType<typeof createContainer>
  let onDragSelect: Mock<(paths: string[]) => void>

  beforeEach(() => {
    scrollContainerRef = createContainer()
    onDragSelect = vi.fn<(paths: string[]) => void>()
  })

  const renderWith = (
    ref: ReturnType<typeof createContainer>,
    { columns = 1, cellWidth = 800, rowHeight = 32, onDragStart }: RenderOptions = {},
  ) =>
    renderHook(() =>
      useFileDragSelect({
        entries: files,
        columns,
        cellWidth,
        rowHeight,
        scrollContainerRef: ref,
        onDragSelect,
        ...(onDragStart ? { onDragStart } : {}),
      }),
    )

  const renderDragSelect = (columns = 1, cellWidth = 800, rowHeight = 32) =>
    renderWith(scrollContainerRef, { columns, cellWidth, rowHeight })

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

  it('滚动后框选矩形按容器可视坐标渲染，命中仍按内容坐标', () => {
    const scrolledRef = createContainer({ scrollY: 64 })
    const { result } = renderWith(scrolledRef)

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 10)))
    act(() => dispatchMouse('mousemove', 50, 50))

    // 内容坐标 74..114 减去 scrollTop 64 才是矩形在容器里的落点。
    expect(result.current.getDragStyle()).toEqual({ left: 10, top: 10, width: 40, height: 40 })

    act(() => dispatchMouse('mouseup', 50, 50))
    expect(onDragSelect).toHaveBeenCalledWith(['/f2', '/f3'])
  })

  it('在竖向滚动条上按下拖动不起框选，也不清空已有选择', () => {
    const onDragStart = vi.fn()
    // clientWidth 785 < rect.width 800：右侧 15px 是滚动条。
    const { result } = renderWith(createContainer({ clientWidth: 785 }), {
      cellWidth: 785,
      onDragStart,
    })

    act(() => result.current.handleMouseDown(mouseDownEvent(792, 10)))
    act(() => dispatchMouse('mousemove', 792, 300))
    act(() => dispatchMouse('mouseup', 792, 300))

    expect(result.current.isDragging).toBe(false)
    expect(result.current.dragSelection).toEqual(new Set())
    expect(onDragStart).not.toHaveBeenCalled()
    expect(onDragSelect).not.toHaveBeenCalled()
  })

  it('在横向滚动条上按下拖动同样不起框选', () => {
    const onDragStart = vi.fn()
    // clientHeight 585 < rect.height 600：底部 15px 是滚动条。
    const { result } = renderWith(createContainer({ clientHeight: 585 }), { onDragStart })

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 592)))
    act(() => dispatchMouse('mousemove', 200, 592))
    act(() => dispatchMouse('mouseup', 200, 592))

    expect(result.current.isDragging).toBe(false)
    expect(onDragStart).not.toHaveBeenCalled()
    expect(onDragSelect).not.toHaveBeenCalled()
  })

  it('紧贴滚动条内侧按下仍可框选', () => {
    const { result } = renderWith(createContainer({ clientWidth: 785 }), { cellWidth: 785 })

    act(() => result.current.handleMouseDown(mouseDownEvent(780, 10)))
    act(() => dispatchMouse('mousemove', 780, 30))
    act(() => dispatchMouse('mouseup', 780, 30))

    expect(onDragSelect).toHaveBeenCalledWith(['/f0'])
  })

  it('宫格框选按列切分后返回跨行条目', () => {
    const { result } = renderDragSelect(3, 200, 100)

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 10)))
    act(() => dispatchMouse('mousemove', 450, 150))
    act(() => dispatchMouse('mouseup', 450, 150))

    expect(onDragSelect).toHaveBeenCalledWith(['/f0', '/f1', '/f2', '/f3', '/f4', '/f5'])
  })

  it('拖拽过程中实时给出框选结果，松手前即可用于高亮', () => {
    const { result } = renderDragSelect()

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 10)))
    act(() => dispatchMouse('mousemove', 10, 40))

    expect(result.current.hasStartedDrag).toBe(true)
    expect(result.current.dragSelection).toEqual(new Set(['/f0', '/f1']))
    expect(onDragSelect).not.toHaveBeenCalled()

    act(() => dispatchMouse('mouseup', 10, 40))
    expect(onDragSelect).toHaveBeenCalledWith(['/f0', '/f1'])
  })

  it('拖拽距离过小时不触发选择回调', () => {
    const { result } = renderDragSelect()

    act(() => result.current.handleMouseDown(mouseDownEvent(10, 10)))
    act(() => dispatchMouse('mousemove', 11, 11))
    act(() => dispatchMouse('mouseup', 11, 11))

    expect(onDragSelect).not.toHaveBeenCalled()
  })
})
