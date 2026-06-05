import type React from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmationDialog } from '@renderer/components/common/ConfirmationDialog.js'
import Button from '@renderer/components/ui/Button.js'
import GlassDialog from '@renderer/components/ui/GlassDialog.js'
import logger from '@renderer/utils/logger.js'
import {
  PORT_SFTP,
  PORT_WEBDAV_HTTPS,
  PROTOCOL,
  type ProtocolType,
  SCHEME,
  type SchemeType,
} from '@shared/constants/index.js'
import { type ConnectionConfig, isErr } from '@shared/types/index.js'
import { ConnectionFormFields } from './ConnectionFormFields.js'

export interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onSave: (config: Omit<ConnectionConfig, 'id'> & { password?: string }) => Promise<void>
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
  const [protocol, setProtocol] = useState<ProtocolType>(config?.protocol ?? PROTOCOL.SFTP)
  const [host, setHost] = useState(config?.host ?? '')
  const [port, setPort] = useState(config?.port?.toString() ?? String(PORT_SFTP))
  const [username, setUsername] = useState(config?.username ?? '')
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(config?.savePassword ?? false)
  const [basePath, setBasePath] = useState(config?.basePath ?? '')
  const [scheme, setScheme] = useState<SchemeType>(config?.scheme ?? SCHEME.HTTPS)
  const [rejectUnauthorized, setRejectUnauthorized] = useState(config?.rejectUnauthorized !== false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCertWarning, setShowCertWarning] = useState(false)

  const [prevOpen, setPrevOpen] = useState(open)
  const [prevConfig, setPrevConfig] = useState(config)
  if (open && (open !== prevOpen || config !== prevConfig)) {
    setPrevOpen(open)
    setPrevConfig(config)
    setError('')
    setIsLoading(false)
    setShowCertWarning(false)
    if (config) {
      setName(config.name)
      setProtocol(config.protocol)
      setHost(config.host)
      setPort(config.port?.toString() ?? String(PORT_SFTP))
      setUsername(config.username)
      setBasePath(config.basePath ?? '')
      setScheme(config.scheme ?? SCHEME.HTTPS)
      setRejectUnauthorized(config.rejectUnauthorized !== false)
      setSavePassword(config.savePassword ?? false)
      setPassword('')
    } else {
      setName('')
      setProtocol(PROTOCOL.SFTP)
      setHost('')
      setPort(String(PORT_SFTP))
      setUsername('')
      setPassword('')
      setSavePassword(false)
      setBasePath('')
      setScheme(SCHEME.HTTPS)
      setRejectUnauthorized(true)
    }
  }

  useEffect(() => {
    if (open && config?.savePassword && config.password) {
      const loadPassword = async () => {
        try {
          const encryptedPassword = config.password
          if (encryptedPassword) {
            const result = await window.electronAPI.crypto.decryptPassword(encryptedPassword)
            if (!isErr(result)) {
              setPassword(result.value)
            }
          }
        } catch (error) {
          logger.catch(error, { action: 'load-password', configId: config.id })
        }
      }
      void loadPassword()
    }
  }, [open, config])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim() || !host.trim() || !username.trim()) {
      setError(t('connectionDialog.fillRequired'))
      return
    }

    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError(t('connectionDialog.invalidPort'))
      return
    }

    if (protocol === PROTOCOL.WEBDAV && scheme === SCHEME.HTTPS && !rejectUnauthorized) {
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
        basePath: protocol === PROTOCOL.WEBDAV ? basePath.trim() : '',
        scheme: protocol === PROTOCOL.WEBDAV ? scheme : SCHEME.HTTP,
        rejectUnauthorized: protocol === PROTOCOL.WEBDAV ? rejectUnauthorized : false,
      })
      onClose()
    } catch (err) {
      logger.catch(err, { action: 'submit-connection' })
      const errorMessage = err instanceof Error ? err.message : String(err)
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCertWarningConfirm = () => {
    setShowCertWarning(false)
    void doSave()
  }

  const handleCertWarningCancel = () => {
    setShowCertWarning(false)
    setRejectUnauthorized(true)
  }

  const handleProtocolChange = (value: string) => {
    setProtocol(value as ProtocolType)
    setPort(value === PROTOCOL.WEBDAV ? String(PORT_WEBDAV_HTTPS) : String(PORT_SFTP))
  }

  const isEditMode = !!config

  return (
    <GlassDialog open={open} onClose={onClose}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isEditMode ? 'bg-success-light' : 'bg-accent-light'
          }`}
        >
          {isEditMode ? (
            <svg
              className="w-4.5 h-4.5 stroke-status-connected stroke-2"
              viewBox="0 0 24 24"
              fill="none"
            >
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
            {isEditMode ? t('connectionDialog.editTitle') : t('connection.newConnection')}
          </h2>
          <p className="text-xs text-text-muted">
            {isEditMode ? host : t('connectionDialog.subtitle')}
          </p>
        </div>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault()
          void handleSubmit()
        }}
        className="flex flex-col gap-3.5"
      >
        <ConnectionFormFields
          name={name}
          onNameChange={setName}
          protocol={protocol}
          onProtocolChange={handleProtocolChange}
          host={host}
          onHostChange={setHost}
          port={port}
          onPortChange={setPort}
          scheme={scheme}
          onSchemeChange={setScheme}
          rejectUnauthorized={rejectUnauthorized}
          onRejectUnauthorizedChange={setRejectUnauthorized}
          basePath={basePath}
          onBasePathChange={setBasePath}
          username={username}
          onUsernameChange={setUsername}
          password={password}
          onPasswordChange={setPassword}
          savePassword={savePassword}
          onSavePasswordChange={setSavePassword}
        />

        {error && (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-danger-light rounded-md text-danger text-xs">
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
            {t('common.action.cancel')}
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {isLoading ? t('connectionDialog.connecting') : t('connectionDialog.save')}
          </Button>
        </div>
      </form>

      <ConfirmationDialog
        open={showCertWarning}
        onClose={() => setShowCertWarning(false)}
        onConfirm={handleCertWarningConfirm}
        onCancel={handleCertWarningCancel}
        title={t('connectionDialog.certWarningTitle')}
        message={t('connectionDialog.certWarningMessage')}
        type="warning"
        confirmText={t('connectionDialog.continue')}
        cancelText={t('common.action.cancel')}
      />
    </GlassDialog>
  )
}

export default ConnectionDialog
