import type { ReactElement, ReactNode } from 'react'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, type RenderResult } from '@testing-library/react'
import { createQueryClient } from '../api/query-client.js'

/** 供 `renderHook(..., { wrapper })` 使用的 Provider 包装器；默认每次创建独立缓存。 */
export function createQueryWrapper(client: QueryClient = createQueryClient()) {
  function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
  return QueryWrapper
}

/** `render` + 独立 QueryClient，避免测试之间共享缓存。 */
export function renderWithQueryClient(
  ui: ReactElement,
  options?: { client?: QueryClient },
): RenderResult & { client: QueryClient } {
  const client = options?.client ?? createQueryClient()
  const Wrapper = createQueryWrapper(client)
  const result = render(ui, { wrapper: Wrapper })
  return Object.assign(result, { client })
}
