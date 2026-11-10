import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileExplorerAddressBar } from './FileExplorerAddressBar.js'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  updateCurrentPath: vi.fn(),
  markSessionStale: vi.fn(),
  addToast: vi.fn(),
  setAddressEditing: vi.fn(),
  editing: true,
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: () => 'translated' }),
}))

vi.mock('../../../stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addressEditingSessionId: mocks.editing ? 's1' : null,
      setAddressEditing: mocks.setAddressEditing,
      addToast: mocks.addToast,
    }),
}))

vi.mock('../../session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ updateCurrentPath: mocks.updateCurrentPath }),
}))

vi.mock('../hooks/index.js', () => ({
  useDirectoryInvalidation: () => ({ markSessionStale: mocks.markSessionStale }),
  useNavigateToDirectory: () => ({ navigate: mocks.navigate }),
}))

vi.mock('./FileExplorerFavorites.js', () => ({ default: () => null }))

const typeAddress = async (value: string) => {
  const input = screen.getByTestId('address-input')
  await userEvent.clear(input)
  await userEvent.type(input, `${value}{Enter}`)
}

const renderBar = () => render(<FileExplorerAddressBar sessionId="s1" currentPath="/old" />)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.editing = true
  mocks.navigate.mockResolvedValue(true)
})

describe('FileExplorerAddressBar', () => {
  it('合法路径交给跳转入口，成功后退出编辑', async () => {
    renderBar()

    await typeAddress('/new')

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalledWith('/new'))
    await waitFor(() => expect(mocks.setAddressEditing).toHaveBeenCalledWith(null))
  })

  it('跳转失败时保持编辑状态，路径不被写回', async () => {
    mocks.navigate.mockResolvedValue(false)
    renderBar()

    await typeAddress('/missing')

    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled())
    expect(mocks.setAddressEditing).not.toHaveBeenCalled()
    expect(mocks.updateCurrentPath).not.toHaveBeenCalled()
  })

  it('相对路径与含 .. 的路径在本地就被拒绝', async () => {
    renderBar()

    await typeAddress('relative')
    await typeAddress('/a/../b')

    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(mocks.addToast).toHaveBeenCalledTimes(2)
  })

  it('输入当前路径时直接退出编辑，不发起跳转', async () => {
    renderBar()

    await typeAddress('/old')

    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(mocks.setAddressEditing).toHaveBeenCalledWith(null)
  })

  it('失去焦点时退出编辑状态', async () => {
    renderBar()

    await userEvent.click(screen.getByTestId('address-input'))
    await userEvent.tab()

    await waitFor(() => expect(mocks.setAddressEditing).toHaveBeenCalledWith(null))
    expect(mocks.navigate).not.toHaveBeenCalled()
  })

  it('面包屑跳转直接改路径并标记陈旧', async () => {
    mocks.editing = false
    renderBar()
    // 第一个按钮是面包屑的根目录，点击不需要 stat。
    const [rootButton] = screen.getAllByRole('button')
    if (!rootButton) throw new Error('breadcrumb root button not found')
    await userEvent.click(rootButton)

    expect(mocks.updateCurrentPath).toHaveBeenCalledWith('s1', '/')
    expect(mocks.markSessionStale).toHaveBeenCalledWith('s1')
  })
})
