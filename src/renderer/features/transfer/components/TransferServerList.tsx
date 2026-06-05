import type React from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Select from '@renderer/components/ui/Select.js'
import { useConnectionStore } from '@renderer/features/session/stores/connection.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import { useTransferStore } from '../stores/transfer.js'
import { TransferServerItem } from './TransferServerItem.js'

interface SessionInfo {
  name: string
  host: string
  port: number
  protocol: string
}

interface TransferServerListProps {
  className?: string
}

export const TransferServerList: React.FC<TransferServerListProps> = ({ className }) => {
  const { t } = useTranslation()
  const maxConcurrency = useTransferStore(state => state.maxConcurrency)
  const selectedSessionId = useTransferStore(state => state.selectedSessionId)
  const setSelectedSessionId = useTransferStore(state => state.setSelectedSessionId)
  const setConcurrency = useTransferStore(state => state.setConcurrency)
  const sessions = useSessionStore(state => state.sessions)
  const connections = useConnectionStore(state => state.connections)

  const sessionSummaries = useTransferStore(state => state.sessionTaskSummaries)
  const runningTaskCount = useTransferStore(state => state.runningTaskCount)

  const sessionInfos = useMemo(() => {
    const map = new Map<string, SessionInfo>()
    for (const summary of sessionSummaries) {
      const session = sessions.find(s => s.sessionId === summary.sessionId)
      if (!session) continue
      const connection = connections.find(c => c.id === session.connectionId)
      if (!connection) continue
      map.set(summary.sessionId, {
        name: connection.name,
        host: connection.host,
        port: connection.port,
        protocol: connection.protocol,
      })
    }
    return map
  }, [sessionSummaries, sessions, connections])

  const handleSelectSession = useCallback(
    (sessionId: string) => () => {
      setSelectedSessionId(selectedSessionId === sessionId ? null : sessionId)
    },
    [selectedSessionId, setSelectedSessionId]
  )

  const handleChangeConcurrency = useCallback(
    (value: string) => {
      setConcurrency(Number.parseInt(value, 10))
    },
    [setConcurrency]
  )

  return (
    <div
      className={`flex flex-col h-full bg-bg ${className ?? ''}`}
      data-testid="transfer-server-list"
    >
      {/* 并发控制 */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <label className="text-sm text-text-muted whitespace-nowrap">
          {t('transfer.concurrency.upload')}
        </label>
        <Select
          value={String(maxConcurrency)}
          onChange={handleChangeConcurrency}
          options={Array.from(
            { length: TRANSFER_CONFIG.MAX_CONCURRENCY - TRANSFER_CONFIG.MIN_CONCURRENCY + 1 },
            (_, i) => ({
              label: String(i + TRANSFER_CONFIG.MIN_CONCURRENCY),
              value: String(i + TRANSFER_CONFIG.MIN_CONCURRENCY),
            })
          )}
          className="flex-1 min-w-0"
        />
      </div>

      <div className="border-t border-border" />

      {/* 服务器列表 */}
      <div className="flex-1 overflow-y-auto">
        {sessionSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full px-4">
            <div className="w-12 h-12 rounded-xl bg-hover flex items-center justify-center">
              <svg
                className="w-5 h-5 stroke-text-muted stroke-[1.5]"
                viewBox="0 0 24 24"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-text-muted text-center leading-relaxed">
              {t('transfer.empty')}
            </p>
          </div>
        ) : (
          <ul className="py-2">
            {sessionSummaries.map(summary => {
              const info = sessionInfos.get(summary.sessionId)
              if (!info) return null

              return (
                <TransferServerItem
                  key={summary.sessionId}
                  sessionId={summary.sessionId}
                  name={info.name}
                  host={info.host}
                  port={info.port}
                  protocol={info.protocol}
                  running={summary.running}
                  failed={summary.failed}
                  total={summary.total}
                  isSelected={summary.sessionId === selectedSessionId}
                  onSelect={handleSelectSession(summary.sessionId)}
                />
              )
            })}
          </ul>
        )}
      </div>

      {/* 底部状态栏 */}
      {runningTaskCount > 0 && (
        <div className="px-4 py-2.5 border-t border-border">
          <span className="text-sm text-text-muted tabular-nums">
            {t('transfer.runningCount', { count: runningTaskCount })}
          </span>
        </div>
      )}
    </div>
  )
}
