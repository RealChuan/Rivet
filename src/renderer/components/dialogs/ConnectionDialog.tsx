import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConnectionConfig } from '@shared/types'
import GlassDialog from './GlassDialog'
import PasswordInput from './PasswordInput'
import GlassSelect from './GlassSelect'

interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onSave: (
    config: Omit<ConnectionConfig, 'id' | 'credentialId'>,
    password?: string,
    privateKey?: string
  ) => Promise<void>
  editConfig?: ConnectionConfig
  reconnectMode?: boolean
  savedPassword?: string
  savedPrivateKey?: string
  authMethod?: 'password' | 'privateKey'
}

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({
  open,
  onClose,
  onSave,
  editConfig,
  reconnectMode = false,
  savedPassword = '',
  savedPrivateKey = '',
  authMethod: initialAuthMethod,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState(editConfig?.name || '')
  const [protocol, setProtocol] = useState<'sftp' | 'webdav'>(editConfig?.protocol || 'sftp')
  const [host, setHost] = useState(editConfig?.host || '')
  const [port, setPort] = useState(editConfig?.port?.toString() || '22')
  const [username, setUsername] = useState(editConfig?.username || '')
  const [password, setPassword] = useState(savedPassword)
  const [authMethod, setAuthMethod] = useState<'password' | 'privateKey'>(
    initialAuthMethod || 'password'
  )
  const [privateKey, setPrivateKey] = useState(savedPrivateKey)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !host.trim() || !username.trim()) {
      setError(t('connection.fillRequired'))
      return
    }

    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError(t('connection.invalidPort'))
      return
    }

    setIsLoading(true)
    setError('')

    try {
      await onSave(
        {
          name: name.trim(),
          protocol,
          host: host.trim(),
          port: portNum,
          username: username.trim(),
        },
        authMethod === 'password' ? password : undefined,
        authMethod === 'privateKey' ? privateKey : undefined
      )
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleProtocolChange = (value: string) => {
    setProtocol(value as 'sftp' | 'webdav')
    setPort(value === 'webdav' ? '443' : '22')
  }

  return (
    <GlassDialog open={open} onClose={onClose}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            backgroundColor: reconnectMode ? 'rgba(78, 201, 176, 0.1)' : 'rgba(59, 130, 246, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {reconnectMode ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#4ec9b0"
              strokeWidth="2"
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2"
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
            {reconnectMode
              ? t('sidebar.reconnect')
              : editConfig
                ? t('connection.editTitle')
                : t('connection.title')}
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {reconnectMode ? host : t('connection.subtitle')}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
      >
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            {t('connection.name')}
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('connection.namePlaceholder')}
            className="glass-input"
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            {t('connection.protocol')}
          </label>
          <GlassSelect
            value={protocol}
            onChange={handleProtocolChange}
            options={[
              { value: 'sftp', label: 'SFTP' },
              { value: 'webdav', label: 'WebDAV' },
            ]}
            className="glass-input"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text)',
                marginBottom: '6px',
              }}
            >
              {t('connection.host')}
            </label>
            <input
              type="text"
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="192.168.1.100"
              className="glass-input"
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text)',
                marginBottom: '6px',
              }}
            >
              {t('connection.port')}
            </label>
            <input
              type="number"
              value={port}
              onChange={e => setPort(e.target.value)}
              placeholder={protocol === 'sftp' ? '22' : '443'}
              className="glass-input"
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            {t('connection.username')}
          </label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={t('connection.usernamePlaceholder')}
            className="glass-input"
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--text)',
              marginBottom: '6px',
            }}
          >
            {t('connection.authMethod')}
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setAuthMethod('password')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${authMethod === 'password' ? 'var(--accent)' : 'var(--border)'}`,
                backgroundColor:
                  authMethod === 'password' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: authMethod === 'password' ? 'var(--accent)' : 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('connection.password')}
            </button>
            <button
              type="button"
              onClick={() => setAuthMethod('privateKey')}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: '6px',
                border: `1px solid ${authMethod === 'privateKey' ? 'var(--accent)' : 'var(--border)'}`,
                backgroundColor:
                  authMethod === 'privateKey' ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
                color: authMethod === 'privateKey' ? 'var(--accent)' : 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t('connection.privateKey')}
            </button>
          </div>
        </div>

        {authMethod === 'password' ? (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text)',
                marginBottom: '6px',
              }}
            >
              {t('connection.password')}
            </label>
            <PasswordInput
              value={password}
              onChange={setPassword}
              placeholder={t('connection.passwordPlaceholder')}
              className="glass-input"
            />
          </div>
        ) : (
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 500,
                color: 'var(--text)',
                marginBottom: '6px',
              }}
            >
              {t('connection.privateKey')}
            </label>
            <textarea
              value={privateKey}
              onChange={e => setPrivateKey(e.target.value)}
              placeholder={t('connection.privateKeyPlaceholder')}
              className="glass-input"
              rows={4}
              style={{ resize: 'vertical', width: '100%' }}
            />
          </div>
        )}

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: 'rgba(241, 76, 76, 0.1)',
              borderRadius: '6px',
              color: '#f14c4c',
              fontSize: '12px',
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
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              backgroundColor: 'transparent',
              color: 'var(--text)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            {t('connection.cancel')}
          </button>
          <button
            type="submit"
            disabled={isLoading}
            style={{
              padding: '8px 16px',
              borderRadius: '6px',
              backgroundColor: isLoading ? 'var(--text-muted)' : 'var(--accent)',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 500,
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isLoading ? (
              <>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ animation: 'spin 1s linear infinite' }}
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
                <span>{t('connection.connecting')}</span>
              </>
            ) : (
              <>{reconnectMode ? t('sidebar.reconnect') : t('connection.save')}</>
            )}
          </button>
        </div>
      </form>
    </GlassDialog>
  )
}

export default ConnectionDialog
