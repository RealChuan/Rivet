import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useUiStore } from '../../stores/ui.js'
import { Toast } from './Toast.js'

// 注意：不能 stub setTimeout/clearTimeout —— Radix Presence、RTL waitFor 与
// store 自动消失 timer 均依赖真实定时器。

describe('Toast component', () => {
  beforeEach(() => {
    // 清理 store 残留 toast（含其内部 timer），避免跨测试污染
    const { toasts } = useUiStore.getState()
    for (const t of toasts) {
      useUiStore.getState().removeToast(t.id)
    }
  })

  it('should export Toast component', () => {
    expect(typeof Toast).toBe('function')
  })

  it('renders toast message from store', async () => {
    useUiStore.getState().addToast({ type: 'success', message: '已保存文件' })
    render(<Toast />)
    expect(await screen.findByText('已保存文件')).toBeTruthy()
  })

  it.each([
    ['success', 'bg-toast-success'],
    ['error', 'bg-toast-error'],
    ['info', 'bg-toast-info'],
    ['warning', 'bg-toast-warning'],
  ] as const)('applies %s background class to toast root', async (type, bgClass) => {
    useUiStore.getState().addToast({ type, message: `${type}-toast` })
    render(<Toast />)
    const li = await screen.findByRole('listitem')
    expect(li.className).toContain(bgClass)
  })

  it('provides role=status announcer for screen readers', async () => {
    useUiStore.getState().addToast({ type: 'info', message: '无障碍提示' })
    render(<Toast />)
    expect(await screen.findByRole('status', {}, { timeout: 2000 })).toBeTruthy()
  })

  it('renders viewport with role=region', async () => {
    useUiStore.getState().addToast({ type: 'info', message: 'region 测试' })
    render(<Toast />)
    expect(await screen.findByRole('region')).toBeTruthy()
  })

  it('close button has accessible name from i18n', async () => {
    useUiStore.getState().addToast({ type: 'info', message: '关闭测试' })
    render(<Toast />)
    expect(await screen.findByRole('button', { name: 'common.close' })).toBeTruthy()
  })

  it('removes toast from store when close button clicked', async () => {
    useUiStore.getState().addToast({ type: 'info', message: '点击关闭' })
    render(<Toast />)
    const closeBtn = await screen.findByRole('button', { name: 'common.close' })
    fireEvent.click(closeBtn)
    expect(useUiStore.getState().toasts).toHaveLength(0)
  })

  it('auto-dismisses after duration via store timer', async () => {
    useUiStore.getState().addToast({ type: 'info', message: '自动消失', duration: 60 })
    render(<Toast />)
    await screen.findByText('自动消失')
    await waitFor(
      () => {
        expect(useUiStore.getState().toasts).toHaveLength(0)
      },
      { timeout: 2000 },
    )
  })
})
