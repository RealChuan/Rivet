import type React from 'react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Select from '@renderer/components/ui/Select.js'
import { useConnectionStore } from '@renderer/features/session/stores/connection.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import { useTransferStore } from '../stores/transfer.js'

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
    const map = new Map<string, { name: string; host: string; port: number }>()
    for (const summary of sessionSummaries) {
      const session = sessions.find(s => s.sessionId === summary.sessionId)
      if (!session) continue
      const connection = connections.find(c => c.id === session.connectionId)
      if (!connection) continue
      map.set(summary.sessionId, {
        name: connection.name,
        host: connection.host,
        port: connection.port,
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
      className={`flex flex-col h-full bg-bg-secondary border-r border-border ${className ?? ''}`}
      data-testid="transfer-server-list"
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <label className="text-[13px] text-text-muted whitespace-nowrap">
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

      <div className="flex-1 overflow-y-auto">
        {sessionSummaries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-2 gap-2.5">
            <svg className="w-8 h-8 stroke-text-muted/40" viewBox="0 0 24 24" fill="none">
              <path
                d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
              <polyline
                points="17 8 12 3 7 8"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
              <line
                x1="12"
                y1="3"
                x2="12"
                y2="15"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
            <p className="text-[12px] text-text-muted text-center leading-relaxed">
              {t('transfer.empty')}
            </p>
          </div>
        ) : (
          <ul>
            {sessionSummaries.map(summary => {
              const { sessionId, running, failed, total } = summary
              const isSelected = sessionId === selectedSessionId
              const info = sessionInfos.get(sessionId)

              const statusColor =
                failed > 0 ? 'bg-danger' : running > 0 ? 'bg-accent' : 'bg-text-muted/30'

              return (
                <li key={sessionId}>
                  <button
                    type="button"
                    onClick={handleSelectSession(sessionId)}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 cursor-pointer
                      transition-colors text-left border-b border-border
                      ${isSelected ? 'bg-accent/8 ring-1 ring-accent/20' : 'hover:bg-hover'}
                    `}
                  >
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`}
                      aria-hidden="true"
                    />

                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[13px] font-medium text-text leading-tight">
                        {info?.name ?? sessionId}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-text-muted mt-0.5 leading-tight">
                        {info ? (
                          <span className="truncate">
                            {info.host}:{info.port}
                          </span>
                        ) : (
                          <span className="truncate">{sessionId}</span>
                        )}
                        <span className="shrink-0 tabular-nums">
                          {running}/{total}
                        </span>
                        {failed > 0 && (
                          <span className="text-danger shrink-0 tabular-nums">
                            {failed} {t('transfer.status.failed')}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {runningTaskCount > 0 && (
        <div className="px-3 py-1.5 border-t border-border bg-bg-secondary/80">
          <span className="text-[11px] text-text-muted tabular-nums">
            {t('transfer.runningCount', { count: runningTaskCount })}
          </span>
        </div>
      )}
    </div>
  )
}
