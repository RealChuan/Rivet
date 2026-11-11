import type React from 'react'
import { FolderOpen, FileText, HardDrive, AlertTriangle, Loader2, PenLine } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { FileInfo } from '@shared/types/index.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { formatDate, formatFileSize } from '@shared/utils/index.js'
import { FileIcon } from '../../../components/common/index.js'
import { Button, DialogFooter, DialogHeader, GlassDialog } from '../../../components/ui/index.js'
import { cn } from '../../../utils/index.js'
import { useSessionStore } from '../../session/stores/session.js'
import { useFolderStats } from '../hooks/use-folder-stats.js'

interface FilePropertiesDialogProps {
  open: boolean
  onClose: () => void
  file: FileInfo | null
  isSftp?: boolean | undefined
  onEditPermissions?: ((file: FileInfo) => void) | undefined
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
      <span className="text-2xs uppercase tracking-wider font-medium">{label}</span>
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

interface FilePropertiesDialogContentProps {
  file: FileInfo
  onClose: () => void
  isSftp?: boolean | undefined
  onEditPermissions?: ((file: FileInfo) => void) | undefined
  open: boolean
}

const FilePropertiesDialogContent = ({
  file,
  onClose,
  isSftp,
  onEditPermissions,
  open,
}: FilePropertiesDialogContentProps) => {
  const { i18n, t } = useTranslation()
  const lng = i18n.language
  const sessionId = useSessionStore((state) => state.activeSessionId)
  // 文件不统计目录大小，但 hook 必须无条件调用；未 start 时它什么都不做。
  const { progress, isCalculating, error, start, cancel } = useFolderStats({
    sessionId: sessionId ?? '',
    path: file.absolutePath,
    enabled: open,
  })

  const isDirectory = file.type === FILE_TYPE.DIRECTORY
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
      <DialogHeader
        icon={<FileIcon type={file.type} name={file.name} className="w-4.5 h-4.5" />}
        iconClassName={isDirectory ? 'bg-warning/10' : 'bg-hover'}
        title={file.name}
        subtitle={file.absolutePath}
        onClose={handleClose}
      />

      <div className="bg-surface rounded-lg p-3 shrink-0">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {isSftp && (
            <>
              <MetadataRow
                label={t(($) => $.properties.permissions)}
                value={file.permissions ?? '-'}
                actionLabel={t(($) => $.permissions.title)}
                onAction={onEditPermissions ? () => onEditPermissions(file) : undefined}
              />
              <MetadataRow label={t(($) => $.properties.owner)} value={file.owner ?? '-'} />
            </>
          )}
          {!isDirectory && (
            <MetadataRow
              label={t(($) => $.properties.size)}
              value={formatFileSize(file.size, lng)}
            />
          )}
          <MetadataRow
            label={t(($) => $.properties.modifyTime)}
            value={formatDate(file.modifyTime, lng)}
          />
        </div>
      </div>

      {isDirectory && (
        <div className="flex-1 flex flex-col min-h-0 mt-4">
          <div className="grid grid-cols-3 gap-2">
            <StatCard
              label={t(($) => $.properties.size)}
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
              label={t(($) => $.properties.fileCount)}
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
              label={t(($) => $.properties.folderCount)}
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

          <div className="mt-auto pt-3">
            {isCalculating && (
              <div className="flex items-center gap-2 px-3 py-2 bg-accent/5 rounded-md border border-accent/10">
                <Loader2 className="w-3.5 h-3.5 stroke-accent animate-spin shrink-0" />
                <span className="text-xs text-text-secondary truncate" title={currentPath}>
                  {t(($) => $.properties.scanning, {
                    path: currentPath || t(($) => $.properties.calculating),
                  })}
                </span>
              </div>
            )}

            {isCompleted && (
              <div className="flex items-center justify-between px-3 py-2 bg-success-light/30 rounded-md border border-success/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-success text-sm">&#10003;</span>
                  <span className="text-xs text-success">{t(($) => $.properties.completed)}</span>
                </div>
              </div>
            )}

            {isCancelled && (
              <div className="flex items-center justify-between px-3 py-2 bg-warning-light/30 rounded-md border border-warning/10">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 stroke-warning shrink-0" />
                  <span className="text-sm text-warning">{t(($) => $.properties.cancelled)}</span>
                </div>
                {errorCount > 0 && (
                  <span className="text-xs text-text-muted">
                    {t(($) => $.properties.errorCount, { count: errorCount })}
                  </span>
                )}
              </div>
            )}

            {isError && (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-danger-light/30 rounded-md border border-danger/10">
                <AlertTriangle className="w-3.5 h-3.5 stroke-danger shrink-0" />
                <span className="text-sm text-danger">{t(($) => $.properties.failed)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <DialogFooter bordered className="mt-3">
        {isDirectory && isIdle && (
          <Button variant="primary" onClick={start}>
            {t(($) => $.properties.calculate)}
          </Button>
        )}
        {isDirectory && isCalculating && (
          <Button variant="secondary" onClick={cancel}>
            {t(($) => $.properties.cancelCalculation)}
          </Button>
        )}
        {isDirectory && (isCompleted || isCancelled || isError) && (
          <Button variant="secondary" onClick={start}>
            {t(($) => $.properties.recalculate)}
          </Button>
        )}
        <Button variant="secondary" onClick={handleClose}>
          {t(($) => $.common.action.close)}
        </Button>
      </DialogFooter>
    </div>
  )
}

export const FilePropertiesDialog = ({
  open,
  onClose,
  file,
  isSftp,
  onEditPermissions,
}: FilePropertiesDialogProps) => {
  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  if (!file) return null

  return (
    <GlassDialog open={open} onClose={handleClose} width={420} height={480}>
      <FilePropertiesDialogContent
        key={file.absolutePath}
        file={file}
        onClose={handleClose}
        isSftp={isSftp}
        onEditPermissions={onEditPermissions}
        open={open}
      />
    </GlassDialog>
  )
}

interface MetadataRowProps {
  label: string
  value: string
  /** 提供时该行变成可点击入口（如权限行进入编辑器） */
  actionLabel?: string | undefined
  onAction?: (() => void) | undefined
}

const MetadataRow = ({ label, value, actionLabel, onAction }: MetadataRowProps) => (
  <>
    <span className="text-xs text-text-muted shrink-0">{label}</span>
    {onAction ? (
      <button
        type="button"
        onClick={onAction}
        title={actionLabel ?? value}
        aria-label={actionLabel ?? value}
        className="group flex items-center gap-1 min-w-0 bg-transparent border-none p-0 text-sm text-text text-left rounded focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 hover:text-accent transition-colors"
      >
        <span className="truncate">{value}</span>
        <PenLine className="w-3 h-3 shrink-0 text-text-muted group-hover:text-accent" />
      </button>
    ) : (
      <span className="text-sm text-text truncate" title={value}>
        {value}
      </span>
    )}
  </>
)

export default FilePropertiesDialog
