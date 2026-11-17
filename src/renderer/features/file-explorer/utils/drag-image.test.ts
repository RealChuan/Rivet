import { describe, expect, it, vi } from 'vitest'
import { type DragImageTransfer, showFileDragImage } from './drag-image.js'

function makeTransfer(): { transfer: DragImageTransfer; setDragImage: ReturnType<typeof vi.fn> } {
  const setDragImage = vi.fn<(image: Element, x: number, y: number) => void>()
  return { transfer: { setDragImage }, setDragImage }
}

function frameOf(setDragImage: ReturnType<typeof vi.fn>): HTMLElement {
  const frame: unknown = setDragImage.mock.calls[0]?.[0]
  if (!(frame instanceof HTMLElement)) throw new Error('drag image is not an element')
  return frame
}

function cardOf(setDragImage: ReturnType<typeof vi.fn>): HTMLElement {
  const card = frameOf(setDragImage).firstElementChild
  if (!(card instanceof HTMLElement)) throw new Error('drag image has no card')
  return card
}

describe('showFileDragImage', () => {
  it('单项拖动只显示名称，并给卡片一个最大宽度让名称截断', () => {
    const { transfer, setDragImage } = makeTransfer()

    showFileDragImage(transfer, 'a-very-long-file-name-that-should-be-truncated.zip', null)

    const card = cardOf(setDragImage)
    const label = card.firstElementChild
    expect(card.textContent).toBe('a-very-long-file-name-that-should-be-truncated.zip')
    expect(card.className).toContain('max-w-60')
    expect(card.className).not.toContain('bg-glass-bg/')
    expect(label?.className).toContain('truncate')
    expect(label?.className).toContain('text-base')
    expect(card.children).toHaveLength(1)
  })

  it('多项拖动把条目数排在名称行尾，卡片保持单行', () => {
    const { transfer, setDragImage } = makeTransfer()

    showFileDragImage(transfer, 'report.pdf', '等 2 项')

    const card = cardOf(setDragImage)
    const [label, count] = Array.from(card.children)
    expect(card.className).toContain('items-center')
    expect(card.className).not.toContain('flex-col')
    expect(label?.textContent).toBe('report.pdf')
    expect(label?.className).toContain('truncate')
    expect(label?.className).toContain('text-base')
    expect(count?.textContent).toBe('等 2 项')
    expect(count?.className).toContain('text-sm')
    expect(count?.className).toContain('text-text-muted')
  })

  it('热点留在卡片外的透明留白里，光标不会压住名称', () => {
    const { transfer, setDragImage } = makeTransfer()

    showFileDragImage(transfer, 'a.txt', null)

    // 热点取图片左上角，卡片靠 padding 与光标隔开。
    expect(setDragImage.mock.calls[0]?.slice(1)).toEqual([0, 0])
    expect(frameOf(setDragImage).className).toContain('p-3')
  })

  it('交给 setDragImage 的元素挂在文档上，随后自行移除', async () => {
    const { transfer, setDragImage } = makeTransfer()

    showFileDragImage(transfer, 'a.txt', null)

    const frame = frameOf(setDragImage)
    expect(frame.isConnected).toBe(true)

    await vi.waitFor(() => expect(frame.isConnected).toBe(false))
  })
})
