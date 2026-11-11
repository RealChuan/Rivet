import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Checkbox } from './Checkbox.js'

const ariaChecked = (name: string) =>
  screen.getByRole('checkbox', { name }).getAttribute('aria-checked')

describe('Checkbox', () => {
  it('按 checked 渲染选中状态', () => {
    const { rerender } = render(<Checkbox checked={false} aria-label="flag" />)
    expect(ariaChecked('flag')).toBe('false')

    rerender(<Checkbox checked aria-label="flag" />)
    expect(ariaChecked('flag')).toBe('true')
  })

  it('点击时回调新状态', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} aria-label="flag" />)

    await userEvent.click(screen.getByRole('checkbox', { name: 'flag' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('disabled 时不回调', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} onChange={onChange} disabled aria-label="flag" />)

    await userEvent.click(screen.getByRole('checkbox', { name: 'flag' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('带文字标签时渲染标签内容', () => {
    render(<Checkbox checked={false} label="显示隐藏文件" />)

    expect(screen.getByText('显示隐藏文件')).not.toBeNull()
  })

  it('未选中时没有光晕阴影，只有描边与勾选填充', () => {
    render(<Checkbox checked={false} aria-label="flag" />)
    const root = screen.getByRole('checkbox', { name: 'flag' })

    expect(root.className).toContain('border-text-muted/70')
    expect(root.className).not.toContain('shadow-[')
    expect(root.className).toContain('cursor-default')
  })
})
