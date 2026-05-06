import { QueryClient } from '@tanstack/react-query'

/** 目录列表视为新鲜的时间：期间切回同一路径直接命中缓存。 */
export const QUERY_STALE_TIME = 30_000

/** 无观察者后缓存保留时间。 */
export const QUERY_GC_TIME = 300_000

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: QUERY_STALE_TIME,
        gcTime: QUERY_GC_TIME,
        refetchOnWindowFocus: false,
      },
    },
  })
}

/** 应用级单例；非 React 代码（如事件回调）也可直接使用。 */
export const queryClient = createQueryClient()

export const queryKeys = {
  /** 目录列表：按会话与远端路径分桶，天然隔离陈旧响应。 */
  directory: (sessionId: string, path: string) => ['list', sessionId, path] as const,
  /** 同一会话的全部目录请求；TanStack Query 按前缀匹配，用于批量失效与在飞统计。 */
  session: (sessionId: string) => ['list', sessionId] as const,
}
