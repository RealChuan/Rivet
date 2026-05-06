import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDirectoryInvalidation } from './use-directory-invalidation.js'
import { useDirectoryList } from './use-directory-list.js'
import { useDirectoryNavigation } from './use-directory-navigation.js'

const listMock = vi.fn((_sessionId: string, _path: string, _requestId: string) =>
  Promise.resolve({ success: true, value: [] }),
)
const cancelMock = vi.fn((_requestId: string) => Promise.resolve(undefined))

function NavigationHarness() {
  const [path, setPath] = useState('/a')
  const { markSessionStale } = useDirectoryInvalidation()
  const { handleNavigate } = useDirectoryNavigation(
    's1',
    path,
    (_sessionId, next) => setPath(next),
    (sessionId) => markSessionStale(sessionId),
  )
  useDirectoryList('s1', path)

  return (
    <button type="button" onClick={() => void handleNavigate('/b')}>
      {path}
    </button>
  )
}

function MutationHarness() {
  const { invalidateSession } = useDirectoryInvalidation()
  useDirectoryList('s1', '/a')

  return (
    <button type="button" onClick={() => void invalidateSession('s1')}>
      mutate
    </button>
  )
}

function renderWithClient(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>)
}

describe('useDirectoryInvalidation', () => {
  beforeEach(() => {
    listMock.mockClear()
    cancelMock.mockClear()
    ;(window as unknown as Record<string, unknown>).electronAPI = {
      protocol: { cancel: cancelMock, list: listMock },
    }
  })

  it('切目录不给旧路径补请求，也不取消任何请求', async () => {
    renderWithClient(<NavigationHarness />)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(listMock.mock.calls.map((call) => call[1])).toEqual(['/a', '/b'])
    })
    expect(cancelMock).not.toHaveBeenCalled()
  })

  it('写操作后仍立即重取当前目录', async () => {
    renderWithClient(<MutationHarness />)
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))

    await userEvent.click(screen.getByRole('button'))

    await waitFor(() => {
      expect(listMock.mock.calls.map((call) => call[1])).toEqual(['/a', '/a'])
    })
  })
})
