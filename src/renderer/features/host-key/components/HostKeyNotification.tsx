import { useTranslation } from 'react-i18next'
import { HOST_KEY_DIALOG_TYPE, type HostKeyDialogType } from '@shared/constants/index.js'

interface HostKeyNotificationProps {
  type: HostKeyDialogType
  host: string
  port: number
  algorithm: string
  fingerprint: string
  previousFingerprint?: string | undefined
}

export const HostKeyNotification = ({
  type,
  host,
  port,
  algorithm,
  fingerprint,
  previousFingerprint,
}: HostKeyNotificationProps) => {
  const { t } = useTranslation()
  const isMismatch = type === HOST_KEY_DIALOG_TYPE.MISMATCH

  return (
    <>
      <div className="mb-4 p-3 bg-subtle-hover rounded-md space-y-2">
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-text-muted">{t(($) => $.hostKey.host)}</span>
          <span className="font-mono text-text break-all select-all">
            {host}:{port}
          </span>
        </div>
        <div className="flex justify-between gap-3 text-xs">
          <span className="text-text-muted">{t(($) => $.hostKey.algorithm)}</span>
          <span className="font-mono text-text">{algorithm}</span>
        </div>
        <div>
          <div className="text-xs text-text-muted mb-1">{t(($) => $.hostKey.fingerprint)}</div>
          <div className="font-mono text-xs text-text break-all select-all">{fingerprint}</div>
        </div>
      </div>

      {isMismatch && previousFingerprint && (
        <div className="mb-4 p-3 bg-danger-subtle border border-danger/20 rounded-md">
          <div className="text-xs text-danger mb-1">{t(($) => $.hostKey.previousFingerprint)}</div>
          <div className="font-mono text-xs text-danger/70 break-all select-all">
            {previousFingerprint}
          </div>
        </div>
      )}

      <div className="text-xs text-text-muted">
        {isMismatch ? t(($) => $.hostKey.mismatchWarning) : t(($) => $.hostKey.unknownWarning)}
      </div>
    </>
  )
}

export default HostKeyNotification
