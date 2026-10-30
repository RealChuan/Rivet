import { keepPreviousData, useIsFetching, useQuery } from '@tanstack/react-query'
import { useRef } from 'react'
import type { FileInfo } from '@shared/types/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { queryKeys } from '../../../api/query-client.js'
import { sanitizeFiles } from '../utils/sanitize-files.js'

export interface DirectoryListResult {
  files: FileInfo[]
  isLoading: boolean
  isFetching: boolean
  error: Error | null
  refetch: () => Promise<void>
}

const EMPTY: DirectoryListResult = {
  files: [],
  isLoading: false,
  isFetching: false,
  error: null,
  refetch: () => Promise.resolve(),
}

/**
 * 目录列表的唯一数据来源。
 * queryKey 决定「谁的结果算数」，AbortSignal 决定「谁需要被真正中止」。
 */
export function useDirectoryList(sessionId: string, path: string): DirectoryListResult {
  const enabled = sessionId.length > 0
  const cancellable = useRef(false)

  const query = useQuery({
    queryKey: queryKeys.directory(sessionId, path),
    queryFn: async (context) => {
      // dev 的 StrictMode 会把首次挂载卸载再挂回。首个查询不消费 signal，React Query 才会
      // 复用同一个 promise；否则它刚发出就被取消，主进程白记一条 REQUEST_ABORTED。
      const files = await protocolApi.list(
        sessionId,
        path,
        cancellable.current ? context.signal : undefined,
      )
      cancellable.current = true
      return files
    },
    enabled,
    placeholderData: keepPreviousData,
    select: sanitizeFiles,
  })

  if (!enabled) {
    return EMPTY
  }

  return {
    files: query.data ?? [],
    isLoading: query.isPending,
    isFetching: query.isFetching,
    error: query.error,
    refetch: async () => {
      await query.refetch()
    },
  }
}

/** 该会话是否还有目录请求在飞；连接列表的转圈图标用它。 */
export function useDirectoryLoading(sessionId: string): boolean {
  const fetchingCount = useIsFetching({ queryKey: queryKeys.session(sessionId) })
  return sessionId.length > 0 && fetchingCount > 0
}
