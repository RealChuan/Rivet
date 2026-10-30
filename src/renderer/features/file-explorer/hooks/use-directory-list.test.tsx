import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useDirectoryList } from './use-directory-list.js'

const listMock = vi.fn((_sessionId: string, _path: string, _requestId: string) =>
  Promise.resolve({ success: true, value: [] }),
)
const cancelMock = vi.fn((_requestId: string) => Promise.resolve(undefined))

function Probe() {
  useDirectoryList('s1', '/')
  return null
}

describe('useDirectoryList', () => {
  beforeEach(() => {
    listMock.mockClear()
    cancelMock.mockClear()
    ;(window as unknown as Record<string, unknown>).electronAPI = {
      protocol: { cancel: cancelMock, list: listMock },
    }
  })

  it('StrictMode 首挂载只发一次 list，且不产生取消', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

    render(
      <StrictMode>
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>
      </StrictMode>,
    )

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    expect(listMock).toHaveBeenCalledTimes(1)
    expect(cancelMock).not.toHaveBeenCalled()
  })
})
