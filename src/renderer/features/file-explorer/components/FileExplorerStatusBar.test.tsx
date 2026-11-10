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

interface RenderBarOptions {
  visibleCount?: number
  isFiltering?: boolean
  selectedSize?: number
  selectedFolderCount?: number
}

const renderBar = (
  selectedCount: number,
  listedCount: number,
  currentPath = '/dir',
  options: RenderBarOptions = {},
) =>
  render(
    <I18nextProvider i18n={i18n}>
      <FileExplorerStatusBar
        currentPath={currentPath}
        onNavigate={vi.fn()}
        selectedCount={selectedCount}
        selectedSize={options.selectedSize ?? 0}
        selectedFolderCount={options.selectedFolderCount ?? 0}
        visibleCount={options.visibleCount ?? listedCount}
        listedCount={listedCount}
        isFiltering={options.isFiltering ?? false}
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

  it('选中的文件显示总大小', () => {
    renderBar(3, 128, '/dir', { selectedSize: 1536 })

    expect(countText()).toBe('3 of 128 selected · 1.5 KB')
  })

  it('选中的文件夹只显示数量', () => {
    renderBar(3, 128, '/dir', { selectedSize: 1024, selectedFolderCount: 2 })

    expect(countText()).toBe('3 of 128 selected · 1 KB · 2 folders')
  })

  it('过滤时显示匹配数与总数', () => {
    renderBar(0, 128, '/dir', { visibleCount: 7, isFiltering: true })

    expect(countText()).toBe('7 of 128 matched')
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
          selectedSize={0}
          selectedFolderCount={0}
          visibleCount={2}
          listedCount={2}
          isFiltering={false}
        />
      </I18nextProvider>,
    )

    await userEvent.click(screen.getByRole('button'))

    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
})
