import type React from 'react'
import { Pencil, Plus, AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ConnectionConfig, ConnectionSaveInput } from '@shared/types/index.js'
import {
  PORT_SFTP,
  PORT_WEBDAV_HTTPS,
  PROTOCOL,
  type ProtocolType,
  SCHEME,
} from '@shared/constants/index.js'
import { dialogApi } from '../../../api/dialog.js'
import { ConfirmationDialog } from '../../../components/common/ConfirmationDialog.js'
import Button from '../../../components/ui/Button.js'
import GlassDialog from '../../../components/ui/GlassDialog.js'
import { resolveErrorMessage } from '../../../i18n/error-message.js'
import logger from '../../../utils/logger.js'
import { ConnectionFormFields, type ConnectionFormValues } from './ConnectionFormFields.js'

interface ConnectionDialogProps {
  open: boolean
  onClose: () => void
  onSave: (input: ConnectionSaveInput) => Promise<void>
  config?: ConnectionConfig | undefined
}

const getDefaultPort = (protocol: ProtocolType): string =>
  protocol === PROTOCOL.WEBDAV ? String(PORT_WEBDAV_HTTPS) : String(PORT_SFTP)

function initialValues(config: ConnectionConfig | undefined): ConnectionFormValues {
  const protocol = config?.protocol ?? PROTOCOL.SFTP
  return {
    name: config?.name ?? '',
    protocol,
    host: config?.host ?? '',
    port: config?.port?.toString() ?? getDefaultPort(protocol),
    username: config?.username ?? '',
    authKind: config?.authKind ?? 'password',
    password: '',
    passphrase: '',
    privateKeyPath: config?.privateKeyPath ?? '',
    agentPath: config?.agentPath ?? '',
    saveSecret: Boolean(config?.secretRef),
    basePath: config?.basePath ?? '',
    scheme: config?.scheme ?? SCHEME.HTTPS,
    rejectUnauthorized: config?.rejectUnauthorized !== false,
  }
}

export const ConnectionDialog = ({ open, onClose, onSave, config }: ConnectionDialogProps) => {
  const { t } = useTranslation()
  const isMountedRef = useRef(true)
  const [values, setValues] = useState<ConnectionFormValues>(() => initialValues(config))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCertWarning, setShowCertWarning] = useState(false)
  const hasStoredSecret = Boolean(config?.secretRef)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // 对话框复用时按打开时的 config 重置表单。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setValues(initialValues(config))
  }, [open, config])

  const handleChange = <K extends keyof ConnectionFormValues>(
    key: K,
    value: ConnectionFormValues[K],
  ) => {
    if (key === 'protocol') {
      const protocol = value === PROTOCOL.WEBDAV ? PROTOCOL.WEBDAV : PROTOCOL.SFTP
      setValues((current) => ({
        ...current,
        protocol,
        port: getDefaultPort(protocol),
        authKind: protocol === PROTOCOL.WEBDAV ? 'password' : current.authKind,
      }))
      return
    }
    setValues((current) => ({ ...current, [key]: value }))
  }

  const validate = (): string | null => {
    if (!values.name.trim() || !values.host.trim() || !values.username.trim()) {
      return t(($) => $.connectionDialog.fillRequired)
    }
    const portNum = parseInt(values.port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return t(($) => $.connectionDialog.invalidPort)
    }
    const authKind = values.protocol === PROTOCOL.WEBDAV ? 'password' : values.authKind
    if (authKind === 'password' && !hasStoredSecret && !values.password) {
      return t(($) => $.connectionDialog.passwordRequired)
    }
    if (authKind === 'privateKey' && !values.privateKeyPath.trim()) {
      return t(($) => $.connectionDialog.privateKeyRequired)
    }
    return null
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    if (
      values.protocol === PROTOCOL.WEBDAV &&
      values.scheme === SCHEME.HTTPS &&
      !values.rejectUnauthorized
    ) {
      setShowCertWarning(true)
      return
    }
    await doSave()
  }

  const doSave = async () => {
    setIsLoading(true)
    setError('')
    const authKind = values.protocol === PROTOCOL.WEBDAV ? 'password' : values.authKind
    const secret =
      authKind === 'password' ? values.password : authKind === 'privateKey' ? values.passphrase : ''

    try {
      await onSave({
        connection: {
          name: values.name.trim(),
          protocol: values.protocol,
          host: values.host.trim(),
          port: parseInt(values.port, 10),
          username: values.username.trim(),
          authKind,
          ...(authKind === 'privateKey' ? { privateKeyPath: values.privateKeyPath.trim() } : {}),
          ...(authKind === 'agent' && values.agentPath.trim()
            ? { agentPath: values.agentPath.trim() }
            : {}),
          ...(values.protocol === PROTOCOL.WEBDAV
            ? {
                basePath: values.basePath.trim(),
                scheme: values.scheme,
                rejectUnauthorized: values.rejectUnauthorized,
              }
            : {}),
        },
        ...(secret ? { secret } : {}),
        saveSecret: values.saveSecret,
      })
      if (isMountedRef.current) onClose()
    } catch (err) {
      logger.catch(err, { action: 'submit-connection' })
      if (isMountedRef.current) setError(resolveErrorMessage(t, err))
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
    handleChange('rejectUnauthorized', true)
  }

  const handleBrowsePrivateKey = async () => {
    try {
      const result = await dialogApi.showOpenDialog({ properties: ['openFile'] })
      const filePath = result?.filePaths[0]
      if (filePath) handleChange('privateKeyPath', filePath)
    } catch (err) {
      logger.catch(err, { action: 'browse-private-key' })
    }
  }

  const isEditMode = !!config

  return (
    <GlassDialog open={open} onClose={onClose} key={config?.id ?? 'new'}>
      <div data-testid="connection-dialog" className="flex items-center gap-3 mb-5">
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
            {isEditMode ? values.host : t(($) => $.connectionDialog.subtitle)}
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
          values={values}
          onChange={handleChange}
          onBrowsePrivateKey={() => void handleBrowsePrivateKey()}
          hasStoredSecret={hasStoredSecret}
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
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            data-testid="connection-save"
          >
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
