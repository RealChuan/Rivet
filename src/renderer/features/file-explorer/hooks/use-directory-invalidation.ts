import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '../../../api/query-client.js'

export interface DirectoryInvalidation {
  invalidateSession: (sessionId: string) => Promise<void>
  markSessionStale: (sessionId: string) => Promise<void>
  invalidatePath: (sessionId: string, path: string) => Promise<void>
}

/** 写操作后的统一失效入口：只按 key 前缀失效，不碰组件内部状态。 */
export function useDirectoryInvalidation(): DirectoryInvalidation {
  const queryClient = useQueryClient()

  return {
    invalidateSession: async (sessionId) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) })
    },
    /**
     * 只标脏、不重取。切目录后观察者还挂在旧路径上，立刻重取等于给马上要被丢弃的
     * 路径补一次请求，切走后它立刻被 abort；目标路径由 queryKey 切换自然重取。
     */
    markSessionStale: async (sessionId) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.session(sessionId),
        refetchType: 'none',
      })
    },
    invalidatePath: async (sessionId, path) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.directory(sessionId, path) })
    },
  }
}
