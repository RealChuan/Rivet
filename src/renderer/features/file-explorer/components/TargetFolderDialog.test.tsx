import { screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { protocolApi } from '../../../api/protocol.js'
import { renderWithQueryClient } from '../../../test-utils/render-with-query-client.js'
import TargetFolderDialog from './TargetFolderDialog.js'

const listMock = vi.mocked(protocolApi.list)
const mkdirMock = vi.mocked(protocolApi.mkdir)

const DIR = {
  name: 'docs',
  type: 'directory' as const,
  size: 0,
  modifyTime: 0,
  absolutePath: '/docs',
}
const FILE = {
  name: 'a.txt',
  type: 'file' as const,
  size: 1,
  modifyTime: 0,
  absolutePath: '/a.txt',
}

vi.mock('../../../api/protocol.js', () => ({
  protocolApi: { list: vi.fn(), mkdir: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | ((ns: unknown) => unknown)) => {
      if (typeof key === 'function') {
        const path: string[] = []
        const proxy = new Proxy(
          {},
          {
            get(_target, prop) {
              if (typeof prop === 'string') path.push(prop)
              return proxy
            },
          },
        )
        key(proxy)
        return path.join('.')
      }
      return key
    },
    i18n: { language: 'en-US' },
  }),
  initReactI18next: vi.fn(),
}))

vi.mock('../hooks/use-element-width.js', () => ({
  useElementWidth: () => 800,
}))

vi.mock('../hooks/use-virtual-rows.js', () => ({
  useVirtualRows: ({ rowCount, rowHeight }: { rowCount: number; rowHeight: number }) =>
    Array.from({ length: rowCount }, (_, index) => ({
      index,
      start: index * rowHeight,
      size: rowHeight,
      key: index,
      end: (index + 1) * rowHeight,
      lane: 0,
    })),
}))

const noop = () => {}

beforeEach(() => {
  listMock.mockReset()
  mkdirMock.mockReset()
  listMock.mockResolvedValue([DIR, FILE])
})

describe('TargetFolderDialog', () => {
  it('只列出目录并过滤文件', async () => {
    renderWithQueryClient(
      <TargetFolderDialog open onClose={noop} onConfirm={noop} sessionId="s1" />,
    )

    expect(await screen.findByText('docs')).not.toBeNull()
    expect(screen.queryByText('a.txt')).toBeNull()
  })

  it('进入子目录后按新路径取数', async () => {
    listMock.mockImplementation((_sessionId, path) => Promise.resolve(path === '/' ? [DIR] : []))
    renderWithQueryClient(
      <TargetFolderDialog open onClose={noop} onConfirm={noop} sessionId="s1" />,
    )

    await userEvent.dblClick(await screen.findByText('docs'))

    await waitFor(() =>
      expect(listMock).toHaveBeenCalledWith('s1', '/docs', expect.any(AbortSignal)),
    )
  })

  it('新建文件夹成功后失效当前路径缓存', async () => {
    mkdirMock.mockResolvedValue(undefined)
    const { client } = renderWithQueryClient(
      <TargetFolderDialog open onClose={noop} onConfirm={noop} sessionId="s1" />,
    )
    const invalidate = vi.spyOn(client, 'invalidateQueries')

    await userEvent.click(await screen.findByLabelText('file.action.newFolder'))
    await userEvent.type(screen.getByRole('textbox'), 'new')
    const confirmButtons = screen.getAllByRole('button', { name: 'common.action.confirm' })
    const confirmButton = confirmButtons[confirmButtons.length - 1]
    if (!confirmButton) throw new Error('confirm button not found')
    await userEvent.click(confirmButton)

    await waitFor(() => expect(mkdirMock).toHaveBeenCalledWith('s1', '/new'))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['list', 's1', '/'] })
  })
})
