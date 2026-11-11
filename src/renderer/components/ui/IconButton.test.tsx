import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { IconButton } from './IconButton.js'

describe('IconButton', () => {
  it('用 label 同时作为 tooltip 与无障碍名', () => {
    render(
      <IconButton onClick={vi.fn()} label="刷新">
        <span>x</span>
      </IconButton>,
    )

    const button = screen.getByRole('button', { name: '刷新' })
    expect(button.getAttribute('title')).toBe('刷新')
  })

  it('ariaLabel 覆盖读屏名但不改 tooltip', () => {
    render(
      <IconButton onClick={vi.fn()} label="刷新 (F5)" ariaLabel="刷新">
        <span>x</span>
      </IconButton>,
    )

    const button = screen.getByRole('button', { name: '刷新' })
    expect(button.getAttribute('title')).toBe('刷新 (F5)')
  })

  it('点击时回调', async () => {
    const onClick = vi.fn()
    render(
      <IconButton onClick={onClick} label="刷新">
        <span>x</span>
      </IconButton>,
    )

    await userEvent.click(screen.getByRole('button', { name: '刷新' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled 时不回调', async () => {
    const onClick = vi.fn()
    render(
      <IconButton onClick={onClick} label="刷新" disabled>
        <span>x</span>
      </IconButton>,
    )

    await userEvent.click(screen.getByRole('button', { name: '刷新' }))

    expect(onClick).not.toHaveBeenCalled()
  })

  it('关闭类用与主窗口一致的红色 hover', () => {
    render(
      <IconButton onClick={vi.fn()} label="关闭" variant="close">
        <span>x</span>
      </IconButton>,
    )

    expect(screen.getByRole('button', { name: '关闭' }).className).toContain(
      'hover:bg-danger hover:text-white',
    )
  })

  it('isActive 时给出 aria-pressed 与选中底色', () => {
    render(
      <IconButton onClick={vi.fn()} label="列表视图" isActive>
        <span>x</span>
      </IconButton>,
    )

    const button = screen.getByRole('button', { name: '列表视图' })
    expect(button.getAttribute('aria-pressed')).toBe('true')
    expect(button.className).toContain('bg-accent-light')
  })
})
