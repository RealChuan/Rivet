import type React from 'react'
import { Pencil, Plus, AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
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
import { type ConnectionConfig } from '@shared/types/index.js'
import { decryptPassword } from '../utils/password-crypto.js'
import { ConnectionFormFields } from './ConnectionFormFields.js'

interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onSave: (config: Omit<ConnectionConfig, 'id'> & { password?: string }) => Promise<void>
  config?: ConnectionConfig | undefined
}

const getDefaultPort = (protocol: ProtocolType): string =>
  protocol === PROTOCOL.WEBDAV ? String(PORT_WEBDAV_HTTPS) : String(PORT_SFTP)

export const ConnectionDialog = ({ open, onClose, onSave, config }: ConnectionDialogProps) => {
  const { t } = useTranslation()
  const isMountedRef = useRef(true)

  const initialProtocol = config?.protocol ?? PROTOCOL.SFTP
  const [name, setName] = useState(config?.name ?? '')
  const [protocol, setProtocol] = useState<ProtocolType>(initialProtocol)
  const [host, setHost] = useState(config?.host ?? '')
  const [port, setPort] = useState(config?.port?.toString() ?? getDefaultPort(initialProtocol))
  const [username, setUsername] = useState(config?.username ?? '')
  const [password, setPassword] = useState('')
  const [savePassword, setSavePassword] = useState(config?.savePassword ?? false)
  const [basePath, setBasePath] = useState(config?.basePath ?? '')
  const [scheme, setScheme] = useState<SchemeType>(config?.scheme ?? SCHEME.HTTPS)
  const [rejectUnauthorized, setRejectUnauthorized] = useState(config?.rejectUnauthorized !== false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCertWarning, setShowCertWarning] = useState(false)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (open && config?.savePassword && config.password) {
      const loadPassword = async () => {
        try {
          const decrypted = await decryptPassword(config.password as string)
          setPassword(decrypted)
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
      setError(t(($) => $.connectionDialog.fillRequired))
      return
    }

    const portNum = parseInt(port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setError(t(($) => $.connectionDialog.invalidPort))
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
      if (isMountedRef.current) onClose()
    } catch (err) {
      logger.catch(err, { action: 'submit-connection' })
      const errorMessage = err instanceof Error ? err.message : String(err)
      if (isMountedRef.current) setError(errorMessage)
    } finally {
      if (isMountedRef.current) setIsLoading(false)
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
    const protocolValue = value === PROTOCOL.WEBDAV ? PROTOCOL.WEBDAV : PROTOCOL.SFTP
    setProtocol(protocolValue)
    setPort(getDefaultPort(protocolValue))
  }

  const isEditMode = !!config

  return (
    <GlassDialog open={open} onClose={onClose} key={config?.id ?? 'new'}>
      <div className="flex items-center gap-3 mb-5">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            isEditMode ? 'bg-success-light' : 'bg-accent-light'
          }`}
        >
          {isEditMode ? (
            <Pencil className="w-4.5 h-4.5 stroke-status-connected stroke-2" />
          ) : (
            <Plus className="w-4.5 h-4.5 stroke-accent stroke-2" />
          )}
        </div>
        <div>
          <h2 className="text-base font-semibold text-text">
            {isEditMode
              ? t(($) => $.connectionDialog.editTitle)
              : t(($) => $.connection.newConnection)}
          </h2>
          <p className="text-xs text-text-muted">
            {isEditMode ? host : t(($) => $.connectionDialog.subtitle)}
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
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
            <AlertCircle className="w-3.5 h-3.5 stroke-current stroke-2" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex justify-end gap-2.5 mt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t(($) => $.common.action.cancel)}
          </Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>
            {isLoading
              ? t(($) => $.connectionDialog.connecting)
              : t(($) => $.connectionDialog.save)}
          </Button>
        </div>
      </form>

      <ConfirmationDialog
        open={showCertWarning}
        onClose={() => setShowCertWarning(false)}
        onConfirm={handleCertWarningConfirm}
        onCancel={handleCertWarningCancel}
        title={t(($) => $.connectionDialog.certWarningTitle)}
        message={t(($) => $.connectionDialog.certWarningMessage)}
        type="warning"
        confirmText={t(($) => $.connectionDialog.continue)}
        cancelText={t(($) => $.common.action.cancel)}
      />
    </GlassDialog>
  )
}

export default ConnectionDialog
