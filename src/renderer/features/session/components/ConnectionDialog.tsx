import type React from 'react'
import { Pencil, Plus, AlertCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AuthKind, ConnectionConfig, ConnectionSaveInput } from '@shared/types/index.js'
import {
  PORT_S3,
  PORT_SFTP,
  PORT_SMB,
  PORT_WEBDAV_HTTPS,
  PROTOCOL,
  type ProtocolType,
  SCHEME,
} from '@shared/constants/index.js'
import { dialogApi } from '../../../api/dialog.js'
import { protocolApi } from '../../../api/protocol.js'
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
  /**
   * 新建连接时的预填字段（目前来自「粘贴地址」）。必须是引用稳定的对象：
   * 它和 `config` 一起作为重置表单的依赖，传内联字面量会在每次父组件渲染时清空用户输入。
   */
  prefill?: Partial<ConnectionFormValues> | undefined
}

const getDefaultPort = (protocol: ProtocolType): string => {
  switch (protocol) {
    case PROTOCOL.WEBDAV:
      return String(PORT_WEBDAV_HTTPS)
    case PROTOCOL.SMB:
      return String(PORT_SMB)
    case PROTOCOL.S3:
      return String(PORT_S3)
    default:
      return String(PORT_SFTP)
  }
}

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
    share: config?.share ?? '',
    domain: config?.domain ?? '',
    basePath: config?.basePath ?? '',
    scheme: config?.scheme ?? SCHEME.HTTPS,
    rejectUnauthorized: config?.rejectUnauthorized !== false,
    bucket: config?.bucket ?? '',
    region: config?.region ?? '',
    pathStyle: config?.pathStyle !== false,
  }
}

export const ConnectionDialog = ({
  open,
  onClose,
  onSave,
  config,
  prefill,
}: ConnectionDialogProps) => {
  const { t } = useTranslation()
  const isMountedRef = useRef(true)
  const [values, setValues] = useState<ConnectionFormValues>(() => initialValues(config))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [showCertWarning, setShowCertWarning] = useState(false)
  const [bucketPickerOpen, setBucketPickerOpen] = useState(false)
  const [buckets, setBuckets] = useState<string[]>([])
  const [bucketError, setBucketError] = useState('')
  const [bucketsLoading, setBucketsLoading] = useState(false)
  const hasStoredSecret = Boolean(config?.secretRef)

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    // 对话框复用时按打开时的 config 重置表单；预填只覆盖它给出的字段。
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setValues({ ...initialValues(config), ...prefill })
  }, [open, config, prefill])

  const handleChange = <K extends keyof ConnectionFormValues>(
    key: K,
    value: ConnectionFormValues[K],
  ) => {
    if (key === 'protocol') {
      // 未知取值一律回退 SFTP：旧配置里出现新协议时不能把表单带到未定义状态。
      const protocol: ProtocolType =
        value === PROTOCOL.WEBDAV
          ? PROTOCOL.WEBDAV
          : value === PROTOCOL.SMB
            ? PROTOCOL.SMB
            : value === PROTOCOL.S3
              ? PROTOCOL.S3
              : PROTOCOL.SFTP
      setValues((current) => ({
        ...current,
        protocol,
        port: getDefaultPort(protocol),
        authKind:
          protocol === PROTOCOL.S3
            ? 'accessKey'
            : protocol === PROTOCOL.WEBDAV || protocol === PROTOCOL.SMB
              ? 'password'
              : current.authKind,
      }))
      return
    }
    setValues((current) => ({ ...current, [key]: value }))
  }

  /** WebDAV/SMB 只有密码，S3 固定 accessKey；其余协议才由用户选。 */
  const effectiveAuthKind = (): AuthKind =>
    values.protocol === PROTOCOL.S3
      ? 'accessKey'
      : values.protocol === PROTOCOL.WEBDAV || values.protocol === PROTOCOL.SMB
        ? 'password'
        : values.authKind

  const validate = (): string | null => {
    if (!values.name.trim() || !values.host.trim() || !values.username.trim()) {
      return t(($) => $.connectionDialog.fillRequired)
    }
    if (values.protocol === PROTOCOL.SMB && !values.share.trim()) {
      return t(($) => $.connectionDialog.shareRequired)
    }
    if (values.protocol === PROTOCOL.S3 && !values.bucket.trim()) {
      return t(($) => $.connectionDialog.bucketRequired)
    }
    const portNum = parseInt(values.port, 10)
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return t(($) => $.connectionDialog.invalidPort)
    }
    const authKind = effectiveAuthKind()
    if (
      (authKind === 'password' || authKind === 'accessKey') &&
      !hasStoredSecret &&
      !values.password
    ) {
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
      (values.protocol === PROTOCOL.WEBDAV || values.protocol === PROTOCOL.S3) &&
      values.scheme === SCHEME.HTTPS &&
      !values.rejectUnauthorized
    ) {
      setShowCertWarning(true)
      return
    }
    await doSave()
  }

  /** 表单 → 连接配置；保存与「列桶」共用同一份，避免两处字段漂移。 */
  const buildConnection = (): ConnectionSaveInput['connection'] => {
    const authKind = effectiveAuthKind()
    return {
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
      ...(values.protocol === PROTOCOL.SMB
        ? {
            share: values.share.trim(),
            ...(values.domain.trim() ? { domain: values.domain.trim() } : {}),
          }
        : {}),
      ...(values.protocol === PROTOCOL.WEBDAV
        ? {
            basePath: values.basePath.trim(),
            scheme: values.scheme,
            rejectUnauthorized: values.rejectUnauthorized,
          }
        : {}),
      ...(values.protocol === PROTOCOL.S3
        ? {
            bucket: values.bucket.trim(),
            region: values.region.trim(),
            pathStyle: values.pathStyle,
            basePath: values.basePath.trim(),
            scheme: values.scheme,
            rejectUnauthorized: values.rejectUnauthorized,
          }
        : {}),
    }
  }

  const doSave = async () => {
    setIsLoading(true)
    setError('')
    const authKind = effectiveAuthKind()
    const secret =
      authKind === 'password' || authKind === 'accessKey'
        ? values.password
        : authKind === 'privateKey'
          ? values.passphrase
          : ''

    try {
      await onSave({
        connection: buildConnection(),
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

  const loadBuckets = async () => {
    setBucketPickerOpen(true)
    setBucketsLoading(true)
    setBucketError('')
    try {
      const list = await protocolApi.listBuckets({
        connection: buildConnection(),
        ...(values.password ? { secret: values.password } : {}),
        ...(config ? { connectionId: config.id } : {}),
      })
      if (isMountedRef.current) setBuckets(list)
    } catch (err) {
      logger.catch(err, { action: 'list-buckets' })
      if (isMountedRef.current) setBucketError(resolveErrorMessage(t, err))
    } finally {
      if (isMountedRef.current) setBucketsLoading(false)
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
          onBrowseBuckets={() => void loadBuckets()}
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

      <GlassDialog open={bucketPickerOpen} onClose={() => setBucketPickerOpen(false)}>
        <h2 className="text-base font-semibold text-text mb-3">
          {t(($) => $.connectionDialog.bucketsTitle)}
        </h2>
        <div className="max-h-72 overflow-auto flex flex-col gap-1" data-testid="bucket-list">
          {bucketsLoading && (
            <span className="text-xs text-text-muted">{t(($) => $.fileExplorerList.loading)}</span>
          )}
          {!bucketsLoading && bucketError !== '' && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-danger-light rounded-md text-danger text-xs">
              <AlertCircle className="w-3.5 h-3.5 stroke-current stroke-2" />
              <span>{bucketError}</span>
            </div>
          )}
          {!bucketsLoading && bucketError === '' && buckets.length === 0 && (
            <span className="text-xs text-text-muted">
              {t(($) => $.connectionDialog.bucketsEmpty)}
            </span>
          )}
          {!bucketsLoading &&
            bucketError === '' &&
            buckets.map((bucket) => (
              <button
                key={bucket}
                type="button"
                onClick={() => {
                  handleChange('bucket', bucket)
                  setBucketPickerOpen(false)
                }}
                className="text-left px-3 py-2 rounded-md text-sm text-text bg-transparent border-none hover:bg-selected"
              >
                {bucket}
              </button>
            ))}
        </div>
        <div className="flex justify-end mt-4">
          <Button type="button" variant="secondary" onClick={() => setBucketPickerOpen(false)}>
            {t(($) => $.common.action.cancel)}
          </Button>
        </div>
      </GlassDialog>
    </GlassDialog>
  )
}

export default ConnectionDialog
