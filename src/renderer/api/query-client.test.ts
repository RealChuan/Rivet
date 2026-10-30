import { describe, expect, it } from 'vitest'
import { createQueryClient, queryKeys } from './query-client.js'

describe('query client', () => {
  it('默认不重试、30s 新鲜、5min 回收、失焦不重取', () => {
    const client = createQueryClient()

    expect(client.getDefaultOptions().queries).toMatchObject({
      retry: false,
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: false,
    })
  })

  it('目录 queryKey 为 [list, sessionId, path]', () => {
    expect(queryKeys.directory('s1', '/var/log')).toEqual(['list', 's1', '/var/log'])
  })
})
