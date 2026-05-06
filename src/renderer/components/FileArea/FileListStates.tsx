import React from 'react'
import { useTranslation } from 'react-i18next'

export const FileListLoading: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            opacity="0.25"
          />
          <path
            d="M12 2a10 10 0 0110 10"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
            strokeLinecap="round"
          />
        </svg>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          {t('fileList.loading')}
        </span>
      </div>
    </div>
  )
}

export const FileListError: React.FC<{ error: string; onRetry: () => void }> = ({
  error,
  onRetry,
}) => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px',
        gap: '16px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'rgba(241, 76, 76, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#f14c4c"
          strokeWidth="2"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <div style={{ textAlign: 'center' }}>
        <h3
          style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', marginBottom: '4px' }}
        >
          Error
        </h3>
        <p style={{ fontSize: '12px', color: '#f14c4c' }}>{error}</p>
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 16px',
          borderRadius: '6px',
          backgroundColor: 'var(--accent)',
          color: '#ffffff',
          fontSize: '12px',
          fontWeight: 500,
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
        {t('fileList.retry')}
      </button>
    </div>
  )
}

export const FileListEmpty: React.FC = () => {
  const { t } = useTranslation()

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--hover)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-muted)"
          strokeWidth="1.5"
        >
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('fileList.empty')}</p>
    </div>
  )
}
