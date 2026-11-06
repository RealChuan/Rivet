import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import i18n from '../../../i18n/config.js'
import { FileExplorerStatusBar } from './FileExplorerStatusBar.js'

// 用真实 i18n 实例：文案里的占位符与 locale 键名都被真的走一遍。
vi.unmock('i18next')
vi.unmock('react-i18next')

beforeAll(async () => {
  if (i18n.isInitialized) return
  await new Promise<void>((resolve) => {
    i18n.on('initialized', () => resolve())
  })
})

const renderBar = (selectedCount: number, totalCount: number, currentPath = '/dir') =>
  render(
    <I18nextProvider i18n={i18n}>
      <FileExplorerStatusBar
        currentPath={currentPath}
        onNavigate={vi.fn()}
        selectedCount={selectedCount}
        totalCount={totalCount}
      />
    </I18nextProvider>,
  )

const countText = (): string | null => screen.getByTestId('file-explorer-count').textContent

describe('FileExplorerStatusBar', () => {
  it('未选中时只显示总项数', () => {
    renderBar(0, 128)

    expect(countText()).toBe('128 items')
  })

  it('有选中时同时显示已选与总数', () => {
    renderBar(3, 128)

    expect(countText()).toBe('3 of 128 selected')
  })

  it('空目录显示 0 项', () => {
    renderBar(0, 0)

    expect(countText()).toBe('0 items')
  })

  it('根目录不渲染上级目录按钮', () => {
    renderBar(0, 2, '/')

    expect(screen.queryByRole('button')).toBeNull()
    expect(countText()).toBe('2 items')
  })

  it('子目录渲染上级目录按钮并可导航', async () => {
    const onNavigate = vi.fn()
    render(
      <I18nextProvider i18n={i18n}>
        <FileExplorerStatusBar
          currentPath="/a/b"
          onNavigate={onNavigate}
          selectedCount={0}
          totalCount={2}
        />
      </I18nextProvider>,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
})
