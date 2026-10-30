import type React from 'react'
import { Folder, HardDrive, FileText, FolderOpen, AlertTriangle, X, Loader2 } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileInfo } from '@shared/types/index.js'
import { formatDate, formatFileSize } from '@shared/utils/index.js'
import Button from '../../../components/ui/Button.js'
import { GlassDialog } from '../../../components/ui/GlassDialog.js'
import { cn } from '../../../utils/index.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useFolderStats } from '../hooks/use-folder-stats.js'

interface FolderPropertiesDialogProps {
  open: boolean
  onClose: () => void
  file: FileInfo | null
  isSftp?: boolean | undefined
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
  open: boolean
}

const FolderPropertiesDialogContent = ({
  file,
  onClose,
  isSftp,
  open,
}: FolderPropertiesDialogContentProps) => {
  const { i18n, t } = useTranslation()
  const lng = i18n.language
  const sessionId = useSessionStore((state) => state.activeSessionId)
  const { progress, isCalculating, error, start, cancel } = useFolderStats({
    sessionId: sessionId ?? '',
    path: file.absolutePath,
    enabled: open,
  })

  const handleClose = () => {
    if (isCalculating) {
      cancel()
    }
    onClose()
  }

  const isIdle = !isCalculating && !error && progress === null
  const isCancelled = progress?.isCancelled === true
  const isCompleted = progress?.isComplete === true
  const isError = error !== null
  const fileCount = progress?.fileCount ?? 0
  const folderCount = progress?.folderCount ?? 0
  const totalSize = progress?.totalSize ?? 0
  const currentPath = progress?.currentPath ?? ''
  const errorCount = progress?.errorCount ?? 0

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
                formatFileSize(totalSize, lng)
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
                fileCount.toLocaleString()
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
                folderCount.toLocaleString()
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
              <span className="text-xs text-text-secondary truncate" title={currentPath}>
                {t(($) => $.folderProperties.scanning, {
                  path: currentPath || t(($) => $.folderProperties.calculating),
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
              {errorCount > 0 && (
                <span className="text-xs text-text-muted">
                  {t(($) => $.folderProperties.errorCount, { count: errorCount })}
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
          <Button variant="primary" onClick={start}>
            {t(($) => $.folderProperties.calculate)}
          </Button>
        )}
        {isCalculating && (
          <Button variant="secondary" onClick={cancel}>
            {t(($) => $.folderProperties.cancelCalculation)}
          </Button>
        )}
        {(isCompleted || isCancelled || isError) && (
          <Button variant="secondary" onClick={start}>
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
        open={open}
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
