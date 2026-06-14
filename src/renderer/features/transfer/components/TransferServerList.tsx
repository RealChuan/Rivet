import type React from 'react'
import { ArrowUpDown } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import Select from '@renderer/components/ui/Select.js'
import VirtualList from '@renderer/components/ui/VirtualList.js'
import { useConnectionStore } from '@renderer/features/session/stores/connection.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { TRANSFER_CONFIG } from '@shared/constants/transfer.js'
import { useTransferStore } from '../stores/transfer.js'
import { TransferServerItem } from './TransferServerItem.js'

const SERVER_ITEM_HEIGHT = 60

interface ServerListItem {
  sessionId: string
  name: string
  host: string
  port: number
  protocol: string
  running: number
  failed: number
  total: number
}

interface TransferServerListProps {
  className?: string
}

export const TransferServerList: React.FC<TransferServerListProps> = ({ className }) => {
  const { t } = useTranslation()
  const selectedSessionId = useTransferStore(state => state.selectedSessionId)
  const setSelectedSessionId = useTransferStore(state => state.setSelectedSessionId)
  const maxUploadConcurrency = useTransferStore(state => state.maxUploadConcurrency)
  const maxDownloadConcurrency = useTransferStore(state => state.maxDownloadConcurrency)
  const setMaxUploadConcurrency = useTransferStore(state => state.setMaxUploadConcurrency)
  const setMaxDownloadConcurrency = useTransferStore(state => state.setMaxDownloadConcurrency)
  const sessions = useSessionStore(state => state.sessions)
  const connections = useConnectionStore(state => state.connections)

  const sessionSummaries = useTransferStore(state => state.sessionTaskSummaries)
  const runningTaskCount = useTransferStore(state => state.runningTaskCount)

  const serverItems = useMemo(() => {
    const items: ServerListItem[] = []
    for (const summary of sessionSummaries) {
      const session = sessions.find(s => s.sessionId === summary.sessionId)
      if (!session) continue
      const connection = connections.find(c => c.id === session.connectionId)
      if (!connection) continue
      items.push({
        sessionId: summary.sessionId,
        name: connection.name,
        host: connection.host,
        port: connection.port,
        protocol: connection.protocol,
        running: summary.running,
        failed: summary.failed,
        total: summary.total,
      })
    }
    return items
  }, [sessionSummaries, sessions, connections])

  const handleChangeUploadConcurrency = (value: string) => {
    setMaxUploadConcurrency(Number.parseInt(value, 10))
  }

  const handleChangeDownloadConcurrency = (value: string) => {
    setMaxDownloadConcurrency(Number.parseInt(value, 10))
  }

  const renderItem = useCallback(
    (item: ServerListItem, _index: number, style: React.CSSProperties) => (
      <TransferServerItem
        key={item.sessionId}
        sessionId={item.sessionId}
        name={item.name}
        host={item.host}
        port={item.port}
        protocol={item.protocol}
        running={item.running}
        failed={item.failed}
        total={item.total}
        isSelected={item.sessionId === selectedSessionId}
        onSelect={() => setSelectedSessionId(item.sessionId)}
        style={style}
      />
    ),
    [selectedSessionId, setSelectedSessionId]
  )

  return (
    <div
      className={`flex flex-col h-full bg-transparent ${className ?? ''}`}
      data-testid="transfer-server-list"
    >
      {/* 并发控制 */}
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <label className="text-sm text-text-muted whitespace-nowrap">
          {t('transfer.concurrency.upload')}
        </label>
        <Select
          value={String(maxUploadConcurrency)}
          onChange={handleChangeUploadConcurrency}
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
      <div className="flex items-center gap-2 px-4 pb-3">
        <label className="text-sm text-text-muted whitespace-nowrap">
          {t('transfer.concurrency.download')}
        </label>
        <Select
          value={String(maxDownloadConcurrency)}
          onChange={handleChangeDownloadConcurrency}
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
      <div className="flex-1 min-h-0">
        {serverItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 h-full px-4">
            <div className="w-12 h-12 rounded-xl bg-hover border border-border flex items-center justify-center">
              <ArrowUpDown className="w-5 h-5 stroke-text-muted stroke-[1.5]" />
            </div>
            <p className="text-sm text-text-muted text-center leading-relaxed">
              {t('transfer.empty')}
            </p>
          </div>
        ) : (
          <VirtualList
            items={serverItems}
            itemHeight={SERVER_ITEM_HEIGHT}
            width="100%"
            renderItem={renderItem}
          />
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
