import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNavigateToDirectory } from './use-navigate-to-directory.js'

const mocks = vi.hoisted(() => ({
  stat: vi.fn(),
  updateCurrentPath: vi.fn(),
  markSessionStale: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('../../../api/protocol.js', () => ({ protocolApi: { stat: mocks.stat } }))

vi.mock('../../session/stores/session.js', () => ({
  useSessionStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ updateCurrentPath: mocks.updateCurrentPath }),
}))

vi.mock('../../../stores/index.js', () => ({
  useUiStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ addToast: mocks.addToast }),
}))

vi.mock('./use-directory-invalidation.js', () => ({
  useDirectoryInvalidation: () => ({ markSessionStale: mocks.markSessionStale }),
}))

const run = async (path: string) => {
  const { result } = renderHook(() => useNavigateToDirectory('s1'))
  let ok = false
  await act(async () => {
    ok = await result.current.navigate(path)
  })
  return ok
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNavigateToDirectory', () => {
  it('目录存在时切换并标脏', async () => {
    mocks.stat.mockResolvedValue({ type: 'directory' })

    expect(await run('/a')).toBe(true)
    expect(mocks.updateCurrentPath).toHaveBeenCalledWith('s1', '/a')
    expect(mocks.markSessionStale).toHaveBeenCalledWith('s1')
  })

  it('目标不是目录时不跳转', async () => {
    mocks.stat.mockResolvedValue({ type: 'file' })

    expect(await run('/a.txt')).toBe(false)
    expect(mocks.updateCurrentPath).not.toHaveBeenCalled()
    expect(mocks.addToast).toHaveBeenCalled()
  })

  it('stat 失败时不跳转并提示', async () => {
    mocks.stat.mockRejectedValue(new Error('not found'))

    expect(await run('/missing')).toBe(false)
    expect(mocks.updateCurrentPath).not.toHaveBeenCalled()
    expect(mocks.addToast).toHaveBeenCalled()
  })
})
