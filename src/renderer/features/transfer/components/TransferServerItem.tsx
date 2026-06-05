import type React from 'react'
import { PROTOCOL } from '@shared/constants/index.js'

interface TransferServerItemProps {
  sessionId: string
  name: string
  host: string
  port: number
  protocol: string
  running: number
  failed: number
  total: number
  isSelected: boolean
  onSelect: () => void
}

export const TransferServerItem: React.FC<TransferServerItemProps> = ({
  name,
  host,
  port,
  protocol,
  running,
  failed,
  total,
  isSelected,
  onSelect,
}) => {
  const isRunning = running > 0
  const hasFailed = failed > 0
  const isSftp = protocol === PROTOCOL.SFTP

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`
          w-full flex items-center gap-3 px-4 py-3 cursor-pointer
          transition-colors duration-150 text-left
          border-b border-border
          ${isSelected ? 'bg-selected' : 'hover:bg-hover bg-transparent'}
        `}
      >
        {/* 左侧：状态指示 + 协议 + 连接信息 */}
        <div className="flex items-center gap-2 min-w-0">
          {/* 运行中脉冲指示 */}
          {isRunning && (
            <span className="w-2 h-2 rounded-full bg-status-connected animate-status-pulse shrink-0" />
          )}

          {/* 协议标签 */}
          <span
            className={`
              shrink-0 text-[11px] px-1.5 py-0.5 rounded-sm font-medium uppercase tracking-[0.5px]
              ${isSftp ? 'text-accent bg-accent-light' : 'text-protocol-webdav bg-protocol-webdav-light'}
            `}
          >
            {protocol.toUpperCase()}
          </span>

          {/* 文字信息 */}
          <div className="min-w-0">
            <div className="truncate text-[15px] font-normal leading-snug text-text">{name}</div>
            <div className="truncate text-xs leading-snug text-text-muted mt-0.5">
              {host}:{port}
            </div>
          </div>
        </div>

        {/* 右侧：任务计数 — 与绿点同行对齐 */}
        <div className="shrink-0 flex flex-col items-end justify-center gap-0.5">
          <span
            className={`tabular-nums text-sm font-semibold leading-none ${
              hasFailed ? 'text-danger' : isRunning ? 'text-status-connected' : 'text-text-muted'
            }`}
          >
            {running}/{total}
          </span>
          {hasFailed && <span className="text-xs text-danger leading-none">{failed} failed</span>}
        </div>
      </button>
    </li>
  )
}

export default TransferServerItem
