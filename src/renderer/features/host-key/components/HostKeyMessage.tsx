import React from 'react'
import { useTranslation } from 'react-i18next'

export interface HostKeyMessageProps {
  type: 'first-connect' | 'mismatch'
  fingerprint: string
  previousFingerprint?: string | undefined
}

export const HostKeyMessage: React.FC<HostKeyMessageProps> = ({
  type,
  fingerprint,
  previousFingerprint,
}) => {
  const { t } = useTranslation()
  const isMismatch = type === 'mismatch'

  return (
    <>
      <div className="mb-4 p-3 bg-[rgba(0,0,0,0.03)] rounded-md">
        <div className="text-xs text-text-muted mb-1">{t('hostKey.currentFingerprint')}:</div>
        <div className="font-mono text-xs text-text break-all select-all">{fingerprint}</div>
      </div>

      {isMismatch && previousFingerprint && (
        <div className="mb-4 p-3 bg-[rgba(241,76,76,0.05)] border border-danger/20 rounded-md">
          <div className="text-xs text-danger mb-1">{t('hostKey.previousFingerprint')}:</div>
          <div className="font-mono text-xs text-danger/70 break-all select-all">
            {previousFingerprint}
          </div>
        </div>
      )}

      <div className="text-xs text-text-muted">
        {isMismatch ? t('hostKey.mismatchWarning') : t('hostKey.firstConnectWarning')}
      </div>
    </>
  )
}

export default HostKeyMessage
