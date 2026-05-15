import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { type ConnectionConfig } from '@shared/types/index.js'
import { ProtocolType } from '@shared/constants/index.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import PasswordInput from '@renderer/components/ui/PasswordInput.js'
import Select from '@renderer/components/ui/Select.js'
import Input from '@renderer/components/ui/Input.js'
import Button from '@renderer/components/ui/Button.js'
import { ConfirmDialog } from '@renderer/components/common/ConfirmDialog.js'
import { fireAndForget } from '@shared/utils/index.js'

export interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onSave: (config: Omit<ConnectionConfig, 'connectionUuid'>) => Promise<void>
  config?: ConnectionConfig | undefined
}

export const ConnectionDialog: React.FC<ConnectionDialogProps> = ({
  open,
  onClose,
  onSave,
  config,
}) => {
  const { t } = useTranslation()
  const [name, setName] = useState(config?.name ?? '')
  const [protocol, setProtocol] = useState<(typeof ProtocolType)[keyof typeof ProtocolType]>(
    config?.protocol ?? ProtocolType.SFTP
  )
  const [host, setHost] = useState(config?.host ?? '')
  const [port, setPort] = useState(config?.port?.toString() ?? '22')
  const [username, setUsername] = useState(config?.username ?? '')
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(config?.savePassword ?? false)
  const [basePath, setBasePath] = useState(config?.basePath ?? '')
  const [scheme, setScheme] = useState<'http' | 'https'>(config?.scheme ?? 'https')
  const [rejectUnauthorized, setRejectUnauthorized] = useState(config?.rejectUnauthorized !== false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCertWarning, setShowCertWarning] = useState(false)

  useEffect(() => {
    if (config) {
      setName(config.name)
      setProtocol(config.protocol)
      setHost(config.host)
      setPort(config.port?.toString() ?? '22')
      setUsername(config.username)
      setBasePath(config.basePath ?? '')
      setScheme(config.scheme ?? 'https')
      setRejectUnauthorized(config.rejectUnauthorized !== false)
      setSavePassword(config.savePassword ?? false)
      setPassword('')

      if (open && config.savePassword && config.connectionUuid) {
        const loadPassword = async () => {
          try {
            const savedPassword = await window.electronAPI.common.getCredential(
              config.connectionUuid
            )
            if (typeof savedPassword === 'string') {
              setPassword(savedPassword)
            }
          } catch (error) {
            console.error('Failed to load password:', error)
          }
        }
        fireAndForget(loadPassword(), 'Failed to load password')
      }
    }
  }, [config, open])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim() || !host.trim() || !username.trim()) {
      setError(t('connection.fillRequired'))
      return
    }

    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError(t('connection.invalidPort'))
      return
    }

    if (protocol === ProtocolType.WEBDAV && scheme === 'https' && !rejectUnauthorized) {
      setShowCertWarning(true)
      return
    }

    await doSave()
  }

  const doSave = async () => {
    setIsLoading(true)
    setError('')

    try {
      await onSave({
        name: name.trim(),
        protocol,
        host: host.trim(),
        port: parseInt(port, 10),
        username: username.trim(),
        password: password || '',
        savePassword,
        basePath: protocol === ProtocolType.WEBDAV ? basePath.trim() : '',
        scheme: protocol === ProtocolType.WEBDAV ? scheme : 'http',
        rejectUnauthorized: protocol === ProtocolType.WEBDAV ? rejectUnauthorized : false,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  const handleCertWarningConfirm = () => {
    setShowCertWarning(false)
    fireAndForget(doSave(), 'Failed to save connection')
  }

  const handleCertWarningCancel = () => {
    setShowCertWarning(false)
    setRejectUnauthorized(true)
  }

  const handleProtocolChange = (value: string) => {
    setProtocol(value as (typeof ProtocolType)[keyof typeof ProtocolType])
    setPort(value === ProtocolType.WEBDAV ? '443' : '22')
  }

  const isEditMode = !!config

  return (
    <GlassDialog open={open} onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isEditMode ? 'bg-[rgba(78,201,176,0.1)]' : 'bg-[rgba(59,130,246,0.1)]'
          }`}
        >
          {isEditMode ? (
            <svg className="w-4.5 h-4.5 stroke-[#4ec9b0] stroke-2" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87" />
              <path d="M16 3.13a4 4 0 010 7.75" />
            </svg>
          ) : (
            <svg className="w-4.5 h-4.5 stroke-accent stroke-2" viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold text-text">
            {isEditMode ? t('connection.editTitle') : t('connection.title')}
          </h2>
          <p className="text-xs text-text-muted">{isEditMode ? host : t('connection.subtitle')}</p>
        </div>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          fireAndForget(handleSubmit(), 'Failed to submit connection')
        }}
        className="flex flex-col gap-3.5"
      >
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t('connection.name')}
          </label>
          <Input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={t('connection.namePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t('connection.protocol')}
          </label>
          <Select
            value={protocol}
            onChange={handleProtocolChange}
            options={[
              { value: ProtocolType.SFTP, label: 'SFTP' },
              { value: ProtocolType.WEBDAV, label: 'WebDAV' },
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t('connection.host')}
            </label>
            <Input
              type="text"
              value={host}
              onChange={e => setHost(e.target.value)}
              placeholder="192.168.1.100"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t('connection.port')}
            </label>
            <Input
              type="number"
              value={port}
              onChange={e => setPort(e.target.value)}
              placeholder={protocol === ProtocolType.SFTP ? '22' : '443'}
            />
          </div>
        </div>

        {protocol === ProtocolType.WEBDAV && (
          <>
            <div>
              <label className="block text-xs font-medium text-text mb-1.5">
                {t('connection.scheme')}
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setScheme('http')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 ${
                    scheme === 'http'
                      ? 'border border-accent bg-[rgba(59,130,246,0.1)] text-accent'
                      : 'border border-[#c0c0c0] bg-transparent text-text hover:border-[#a0a0a0] hover:bg-[rgba(0,0,0,0.03)]'
                  }`}
                >
                  HTTP
                </button>
                <button
                  type="button"
                  onClick={() => setScheme('https')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 ${
                    scheme === 'https'
                      ? 'border border-accent bg-[rgba(59,130,246,0.1)] text-accent'
                      : 'border border-[#c0c0c0] bg-transparent text-text hover:border-[#a0a0a0] hover:bg-[rgba(0,0,0,0.03)]'
                  }`}
                >
                  HTTPS
                </button>
              </div>
            </div>
            {scheme === 'https' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="rejectUnauthorized"
                  checked={rejectUnauthorized}
                  onChange={e => setRejectUnauthorized(e.target.checked)}
                  className="w-4 h-4 rounded border-[#c0c0c0] text-accent focus:ring-accent focus:ring-offset-0"
                />
                <label htmlFor="rejectUnauthorized" className="text-sm text-text cursor-pointer">
                  {t('connection.rejectUnauthorized')}
                </label>
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-text mb-1.5">
                {t('connection.basePath')}
              </label>
              <Input
                type="text"
                value={basePath}
                onChange={e => setBasePath(e.target.value)}
                placeholder="/dav/files"
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t('connection.username')}
          </label>
          <Input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder={t('connection.usernamePlaceholder')}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t('connection.password')}
          </label>
          <PasswordInput
            value={password}
            onChange={setPassword}
            placeholder={t('connection.passwordPlaceholder')}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="savePassword"
            checked={savePassword}
            onChange={e => setSavePassword(e.target.checked)}
            className="w-4 h-4 rounded border-[#c0c0c0] text-accent focus:ring-accent focus:ring-offset-0"
          />
          <label htmlFor="savePassword" className="text-sm text-text cursor-pointer">
            {t('connection.savePassword')}
          </label>
        </div>

        {error && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-[rgba(241,76,76,0.1)] rounded-md text-danger text-xs">
            <svg className="w-3.5 h-3.5 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2.5 mt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('connection.cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {isLoading ? t('connection.connecting') : t('connection.save')}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={showCertWarning}
        onClose={() => setShowCertWarning(false)}
        onConfirm={handleCertWarningConfirm}
        onCancel={handleCertWarningCancel}
        title={t('connection.certWarningTitle')}
        message={t('connection.certWarningMessage')}
        type="warning"
        confirmText={t('connection.continue')}
        cancelText={t('connection.cancel')}
      />
    </GlassDialog>
  )
}

export default ConnectionDialog
