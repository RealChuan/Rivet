import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlassDialog } from './GlassDialog.js'

describe('GlassDialog component', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should export GlassDialog component', () => {
    expect(typeof GlassDialog).toBe('function')
  })

  it('拖拽中卸载组件不泄漏监听器', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = render(
      <GlassDialog open onClose={vi.fn()}>
        <div>content</div>
      </GlassDialog>,
    )

    const dialog = screen.getByRole('dialog')
    fireEvent.mouseDown(dialog)

    // 拖拽开始：mousemove/mouseup 监听器已添加到 document
    expect(addSpy).toHaveBeenCalledWith('mousemove', expect.any(Function))
    expect(addSpy).toHaveBeenCalledWith('mouseup', expect.any(Function))

    // 卸载组件（模拟拖拽过程中 dialog 被关闭）
    unmount()

    // 卸载后：mousemove/mouseup 监听器已全部移除（添加数 === 移除数，无泄漏）
    const moveAdded = addSpy.mock.calls.filter(([type]) => type === 'mousemove').length
    const moveRemoved = removeSpy.mock.calls.filter(([type]) => type === 'mousemove').length
    const upAdded = addSpy.mock.calls.filter(([type]) => type === 'mouseup').length
    const upRemoved = removeSpy.mock.calls.filter(([type]) => type === 'mouseup').length
    expect(moveRemoved).toBe(moveAdded)
    expect(upRemoved).toBe(upAdded)
  })
})
