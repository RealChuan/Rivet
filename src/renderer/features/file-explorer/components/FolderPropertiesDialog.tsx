import type React from 'react'
import { Folder, HardDrive, FileText, FolderOpen, AlertTriangle, X, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileInfo, FolderStatsProgress } from '@shared/types/index.js'
import Button from '@renderer/components/ui/Button.js'
import { GlassDialog } from '@renderer/components/ui/GlassDialog.js'
import { useSessionStore } from '@renderer/features/session/stores/session.js'
import { useUiStore } from '@renderer/stores/index.js'
import { cn } from '@renderer/utils/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { isErr } from '@shared/types/index.js'
import { formatDate, formatFileSize } from '@shared/utils/index.js'

export const STATS_STATUS = {
  IDLE: 'idle',
  CALCULATING: 'calculating',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  ERROR: 'error',
} as const

export type StatsStatus = (typeof STATS_STATUS)[keyof typeof STATS_STATUS]

interface FolderPropertiesDialogProps {
  open: boolean
  onClose: () => void
  file: FileInfo | null
  isSftp?: boolean | undefined
}

interface StatsState {
  status: StatsStatus
  fileCount: number
  folderCount: number
  totalSize: number
  currentPath: string
  errorCount: number
}

const initialStats: StatsState = {
  status: STATS_STATUS.IDLE,
  fileCount: 0,
  folderCount: 0,
  totalSize: 0,
  currentPath: '',
  errorCount: 0,
}

interface StatCardProps {
  label: string
  value: string | React.ReactNode
  icon?: React.ReactNode
  highlight?: boolean
}

const StatCard = ({ label, value, icon, highlight }: StatCardProps) => (
  <div className="flex flex-col items-center gap-1.5 px-3 py-3 bg-surface rounded-lg min-w-0">
    <div className="flex items-center gap-1 text-text-muted">
      {icon}
      <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
    </div>
    <span
      className={cn(
        'text-base font-semibold tabular-nums truncate',
        highlight ? 'text-accent' : 'text-text',
      )}
    >
      {value}
    </span>
  </div>
)

interface FolderPropertiesDialogContentProps {
  file: FileInfo
  onClose: () => void
  isSftp?: boolean | undefined
}

const FolderPropertiesDialogContent = ({
  file,
  onClose,
  isSftp,
}: FolderPropertiesDialogContentProps) => {
  const { i18n, t } = useTranslation()
  const lng = i18n.language
  const sessionId = useSessionStore((state) => state.activeSessionId)
  const addToast = useUiStore((state) => state.addToast)
  const [stats, setStats] = useState<StatsState>(initialStats)

  const startCalculation = useCallback(() => {
    if (!sessionId) return
    setStats({
      status: STATS_STATUS.CALCULATING,
      fileCount: 0,
      folderCount: 0,
      totalSize: 0,
      currentPath: '',
      errorCount: 0,
    })
    window.electronAPI.protocol
      .calculateFolderStats(sessionId, file.absolutePath)
      .then((result) => {
        if (isErr(result)) {
          setStats((prev) => ({ ...prev, status: STATS_STATUS.ERROR }))
          addToast({ type: TOAST_TYPE.ERROR, message: result.error.message })
        }
      })
      .catch(() => {
        setStats((prev) => ({ ...prev, status: STATS_STATUS.ERROR }))
      })
  }, [sessionId, file.absolutePath, addToast])

  const cancelCalculation = useCallback(() => {
    if (!sessionId) return
    void window.electronAPI.protocol.cancelCalculateFolderStats(sessionId)
  }, [sessionId])

  useEffect(() => {
    const unsubscribe = window.electronAPI.protocol.onFolderStatsProgress(
      (data: FolderStatsProgress & { sessionId: string }) => {
        if (data.sessionId !== sessionId) return

        setStats({
          status: data.isCancelled
            ? STATS_STATUS.CANCELLED
            : data.isComplete
              ? STATS_STATUS.COMPLETED
              : STATS_STATUS.CALCULATING,
          fileCount: data.fileCount,
          folderCount: data.folderCount,
          totalSize: data.totalSize,
          currentPath: data.currentPath,
          errorCount: data.errorCount,
        })
      },
    )

    return unsubscribe
  }, [sessionId])

  const handleClose = useCallback(() => {
    if (stats.status === STATS_STATUS.CALCULATING) {
      cancelCalculation()
    }
    onClose()
  }, [stats.status, cancelCalculation, onClose])

  const isCalculating = stats.status === STATS_STATUS.CALCULATING
  const isIdle = stats.status === STATS_STATUS.IDLE
  const isCancelled = stats.status === STATS_STATUS.CANCELLED
  const isCompleted = stats.status === STATS_STATUS.COMPLETED
  const isError = stats.status === STATS_STATUS.ERROR

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Folder className="w-4.5 h-4.5 stroke-warning fill-warning/20 stroke-2" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text leading-tight">{file.name}</h2>
            <p
              className="text-xs text-text-muted mt-0.5 truncate max-w-72"
              title={file.absolutePath}
            >
              {file.absolutePath}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
          aria-label={t(($) => $.common.close)}
          className="p-1 rounded-md bg-transparent border-none cursor-pointer text-text-muted hover:text-text hover:bg-hover transition-colors focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2"
        >
          <X className="w-4 h-4 stroke-current stroke-2" />
        </button>
      </div>

      {/* Metadata Section */}
      <div className="bg-surface rounded-lg p-3 shrink-0">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {isSftp && (
            <>
              <MetadataRow
                label={t(($) => $.folderProperties.permissions)}
                value={file.permissions ?? '-'}
              />
              <MetadataRow label={t(($) => $.folderProperties.owner)} value={file.owner ?? '-'} />
            </>
          )}
          <MetadataRow
            label={t(($) => $.folderProperties.modifyTime)}
            value={formatDate(file.modifyTime, lng)}
          />
        </div>
      </div>

      {/* Stats Section - Hero Area */}
      <div className="flex-1 flex flex-col min-h-0 mt-4">
        {/* Stat Cards Grid */}
        <div className="grid grid-cols-3 gap-2">
          <StatCard
            label={t(($) => $.folderProperties.size)}
            value={
              isIdle ? (
                <span className="text-text-muted font-normal">--</span>
              ) : (
                formatFileSize(stats.totalSize, lng)
              )
            }
            icon={<HardDrive className="w-3.5 h-3.5" />}
            highlight={!isIdle}
          />
          <StatCard
            label={t(($) => $.folderProperties.fileCount)}
            value={
              isIdle ? (
                <span className="text-text-muted font-normal">--</span>
              ) : (
                stats.fileCount.toLocaleString()
              )
            }
            icon={<FileText className="w-3.5 h-3.5" />}
          />
          <StatCard
            label={t(($) => $.folderProperties.folderCount)}
            value={
              isIdle ? (
                <span className="text-text-muted font-normal">--</span>
              ) : (
                stats.folderCount.toLocaleString()
              )
            }
            icon={<FolderOpen className="w-3.5 h-3.5" />}
          />
        </div>

        {/* Progress / Status Bar */}
        <div className="mt-auto pt-3">
          {isCalculating && (
            <div className="flex items-center gap-2 px-3 py-2 bg-accent/5 rounded-md border border-accent/10">
              <Loader2 className="w-3.5 h-3.5 stroke-accent animate-spin shrink-0" />
              <span className="text-xs text-text-secondary truncate" title={stats.currentPath}>
                {t(($) => $.folderProperties.scanning, {
                  path: stats.currentPath || t(($) => $.folderProperties.calculating),
                })}
              </span>
            </div>
          )}

          {isCompleted && (
            <div className="flex items-center justify-between px-3 py-2 bg-success-light/30 rounded-md border border-success/10">
              <div className="flex items-center gap-1.5">
                <span className="text-success text-sm">&#10003;</span>
                <span className="text-xs text-success">
                  {t(($) => $.folderProperties.completed)}
                </span>
              </div>
            </div>
          )}

          {isCancelled && (
            <div className="flex items-center justify-between px-3 py-2 bg-warning-light/30 rounded-md border border-warning/10">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 stroke-warning shrink-0" />
                <span className="text-sm text-warning">
                  {t(($) => $.folderProperties.cancelled)}
                </span>
              </div>
              {stats.errorCount > 0 && (
                <span className="text-xs text-text-muted">
                  {t(($) => $.folderProperties.errorCount, { count: stats.errorCount })}
                </span>
              )}
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-danger-light/30 rounded-md border border-danger/10">
              <AlertTriangle className="w-3.5 h-3.5 stroke-danger shrink-0" />
              <span className="text-sm text-danger">{t(($) => $.folderProperties.failed)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Buttons */}
      <div className="flex justify-end gap-2.5 pt-4 mt-3 border-t border-border shrink-0">
        {isIdle && (
          <Button variant="primary" onClick={startCalculation}>
            {t(($) => $.folderProperties.calculate)}
          </Button>
        )}
        {isCalculating && (
          <Button variant="secondary" onClick={cancelCalculation}>
            {t(($) => $.folderProperties.cancelCalculation)}
          </Button>
        )}
        {(isCompleted || isCancelled || isError) && (
          <Button variant="secondary" onClick={startCalculation}>
            {t(($) => $.folderProperties.recalculate)}
          </Button>
        )}
        <Button variant="secondary" onClick={handleClose}>
          {t(($) => $.common.action.close)}
        </Button>
      </div>
    </div>
  )
}

export const FolderPropertiesDialog = ({
  open,
  onClose,
  file,
  isSftp,
}: FolderPropertiesDialogProps) => {
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  if (!file) return null

  return (
    <GlassDialog open={open} onClose={handleClose} width={420} height={480}>
      <FolderPropertiesDialogContent
        key={file.absolutePath}
        file={file}
        onClose={handleClose}
        isSftp={isSftp}
      />
    </GlassDialog>
  )
}

const MetadataRow = ({ label, value }: { label: string; value: string }) => (
  <>
    <span className="text-xs text-text-muted shrink-0">{label}</span>
    <span className="text-sm text-text truncate" title={value}>
      {value}
    </span>
  </>
)

export default FolderPropertiesDialog
