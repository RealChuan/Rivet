import { useCallback, useEffect, useRef, useState } from 'react'
import type { FolderStatsProgress } from '@shared/types/index.js'
import { protocolApi } from '../../../api/protocol.js'

interface UseFolderStatsOptions {
  sessionId: string
  path: string
  enabled: boolean
}

export interface FolderStatsState {
  progress: FolderStatsProgress | null
  isCalculating: boolean
  error: string | null
  start: () => void
  cancel: () => void
}

export function useFolderStats({
  sessionId,
  path,
  enabled,
}: UseFolderStatsOptions): FolderStatsState {
  const [progress, setProgress] = useState<FolderStatsProgress | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isCalculatingRef = useRef(false)

  const updateCalculating = useCallback((value: boolean) => {
    isCalculatingRef.current = value
    setIsCalculating(value)
  }, [])

  const start = useCallback(() => {
    setProgress(null)
    setError(null)
    updateCalculating(true)

    void protocolApi.calculateFolderStats(sessionId, path).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause))
      updateCalculating(false)
    })
  }, [path, sessionId, updateCalculating])

  const cancel = useCallback(() => {
    void protocolApi.cancelCalculateFolderStats(sessionId)
    updateCalculating(false)
  }, [sessionId, updateCalculating])

  useEffect(() => {
    if (!enabled || sessionId.length === 0) return

    const unsubscribe = protocolApi.onFolderStatsProgress((data) => {
      if (data.sessionId !== sessionId) return

      setProgress(data)
      if (data.isComplete || data.isCancelled) {
        updateCalculating(false)
      }
    })

    return () => {
      unsubscribe()
      if (isCalculatingRef.current) {
        void protocolApi.cancelCalculateFolderStats(sessionId)
        updateCalculating(false)
      }
    }
  }, [enabled, sessionId, updateCalculating])

  return { progress, isCalculating, error, start, cancel }
}
