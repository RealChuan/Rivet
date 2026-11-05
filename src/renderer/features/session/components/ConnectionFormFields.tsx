import { useTranslation } from 'react-i18next'

import type { AuthKind } from '@shared/types/index.js'
import {
  PORT_S3,
  PORT_SFTP,
  PORT_SMB,
  PORT_WEBDAV_HTTPS,
  PROTOCOL,
  type ProtocolType,
  SCHEME,
  type SchemeType,
} from '@shared/constants/index.js'
import { Checkbox } from '../../../components/ui/Checkbox.js'
import Input from '../../../components/ui/Input.js'
import PasswordInput from '../../../components/ui/PasswordInput.js'
import Select from '../../../components/ui/Select.js'
import { cn } from '../../../utils/index.js'

export interface ConnectionFormValues {
  name: string
  protocol: ProtocolType
  host: string
  port: string
  username: string
  authKind: AuthKind
  password: string
  passphrase: string
  privateKeyPath: string
  agentPath: string
  saveSecret: boolean
  share: string
  domain: string
  basePath: string
  scheme: SchemeType
  rejectUnauthorized: boolean
  bucket: string
  region: string
  pathStyle: boolean
}

interface ConnectionFormFieldsProps {
  values: ConnectionFormValues
  onChange: <K extends keyof ConnectionFormValues>(key: K, value: ConnectionFormValues[K]) => void
  onBrowsePrivateKey: () => void
  hasStoredSecret: boolean
}

export const ConnectionFormFields = ({
  values,
  onChange,
  onBrowsePrivateKey,
  hasStoredSecret,
}: ConnectionFormFieldsProps) => {
  const { t } = useTranslation()
  const isWebdav = values.protocol === PROTOCOL.WEBDAV
  const isSmb = values.protocol === PROTOCOL.SMB
  const isS3 = values.protocol === PROTOCOL.S3
  const isPasswordOnly = isWebdav || isSmb
  const usesHttp = isWebdav || isS3
  const isPassword = isS3 || values.authKind === 'password' || isPasswordOnly
  const isPrivateKey = !isPasswordOnly && !isS3 && values.authKind === 'privateKey'
  const secretPlaceholder = hasStoredSecret
    ? t(($) => $.connectionDialog.secretSavedPlaceholder)
    : isPrivateKey
      ? t(($) => $.connectionDialog.passphrasePlaceholder)
      : isS3
        ? t(($) => $.connectionDialog.secretAccessKeyPlaceholder)
        : t(($) => $.connectionDialog.passwordPlaceholder)

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t(($) => $.connectionDialog.name)}
        </label>
        <Input
          type="text"
          data-testid="connection-name"
          value={values.name}
          onChange={(e) => onChange('name', e.target.value)}
          placeholder={t(($) => $.connectionDialog.namePlaceholder)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t(($) => $.connectionDialog.protocol)}
        </label>
        <Select
          testId="connection-protocol"
          value={values.protocol}
          onChange={(value) => onChange('protocol', value as ProtocolType)}
          options={[
            { value: PROTOCOL.SFTP, label: t(($) => $.connectionDialog.protocolSftp) },
            { value: PROTOCOL.SMB, label: t(($) => $.connectionDialog.protocolSmb) },
            { value: PROTOCOL.WEBDAV, label: t(($) => $.connectionDialog.protocolWebdav) },
            { value: PROTOCOL.S3, label: t(($) => $.connectionDialog.protocolS3) },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t(($) => $.connectionDialog.host)}
          </label>
          <Input
            type="text"
            data-testid="connection-host"
            value={values.host}
            onChange={(e) => onChange('host', e.target.value)}
            placeholder={t(($) => $.connectionDialog.hostPlaceholder)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t(($) => $.connectionDialog.port)}
          </label>
          <Input
            type="number"
            data-testid="connection-port"
            value={values.port}
            onChange={(e) => onChange('port', e.target.value)}
            placeholder={
              values.protocol === PROTOCOL.SFTP
                ? String(PORT_SFTP)
                : values.protocol === PROTOCOL.SMB
                  ? String(PORT_SMB)
                  : values.protocol === PROTOCOL.S3
                    ? String(PORT_S3)
                    : String(PORT_WEBDAV_HTTPS)
            }
          />
        </div>
      </div>

      {isSmb && (
        <>
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t(($) => $.connectionDialog.share)}
            </label>
            <Input
              type="text"
              data-testid="connection-share"
              value={values.share}
              onChange={(e) => onChange('share', e.target.value)}
              placeholder={t(($) => $.connectionDialog.sharePlaceholder)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t(($) => $.connectionDialog.domain)}
            </label>
            <Input
              type="text"
              data-testid="connection-domain"
              value={values.domain}
              onChange={(e) => onChange('domain', e.target.value)}
              placeholder={t(($) => $.connectionDialog.domainPlaceholder)}
            />
          </div>
        </>
      )}

      {isS3 && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-text mb-1.5">
                {t(($) => $.connectionDialog.bucket)}
              </label>
              <Input
                type="text"
                data-testid="connection-bucket"
                value={values.bucket}
                onChange={(e) => onChange('bucket', e.target.value)}
                placeholder={t(($) => $.connectionDialog.bucketPlaceholder)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text mb-1.5">
                {t(($) => $.connectionDialog.region)}
              </label>
              <Input
                type="text"
                data-testid="connection-region"
                value={values.region}
                onChange={(e) => onChange('region', e.target.value)}
                placeholder={t(($) => $.connectionDialog.regionPlaceholder)}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="pathStyle"
              checked={values.pathStyle}
              onChange={(value) => onChange('pathStyle', value)}
            />
            <label htmlFor="pathStyle" className="text-sm text-text">
              {t(($) => $.connectionDialog.pathStyle)}
            </label>
          </div>
        </>
      )}

      {usesHttp && (
        <>
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t(($) => $.connectionDialog.scheme)}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="connection-scheme-http"
                onClick={() => onChange('scheme', SCHEME.HTTP)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
                  values.scheme === SCHEME.HTTP
                    ? 'border border-accent bg-accent-light text-accent'
                    : 'border border-input-border bg-transparent text-text hover:border-input-border-hover hover:bg-input-hover-bg',
                )}
              >
                {t(($) => $.connectionDialog.schemeHttp)}
              </button>
              <button
                type="button"
                data-testid="connection-scheme-https"
                onClick={() => onChange('scheme', SCHEME.HTTPS)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
                  values.scheme === SCHEME.HTTPS
                    ? 'border border-accent bg-accent-light text-accent'
                    : 'border border-input-border bg-transparent text-text hover:border-input-border-hover hover:bg-input-hover-bg',
                )}
              >
                {t(($) => $.connectionDialog.schemeHttps)}
              </button>
            </div>
          </div>
          {values.scheme === SCHEME.HTTPS && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="rejectUnauthorized"
                checked={values.rejectUnauthorized}
                onChange={(value) => onChange('rejectUnauthorized', value)}
              />
              <label htmlFor="rejectUnauthorized" className="text-sm text-text">
                {t(($) => $.connectionDialog.rejectUnauthorized)}
              </label>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t(($) => $.connectionDialog.basePath)}
            </label>
            <Input
              type="text"
              data-testid="connection-base-path"
              value={values.basePath}
              onChange={(e) => onChange('basePath', e.target.value)}
              placeholder={t(($) => $.connectionDialog.basePathPlaceholder)}
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {isS3 ? t(($) => $.connectionDialog.accessKeyId) : t(($) => $.connectionDialog.username)}
        </label>
        <Input
          type="text"
          data-testid="connection-username"
          value={values.username}
          onChange={(e) => onChange('username', e.target.value)}
          placeholder={
            isS3
              ? t(($) => $.connectionDialog.accessKeyIdPlaceholder)
              : t(($) => $.connectionDialog.usernamePlaceholder)
          }
        />
      </div>

      {!isPasswordOnly && !isS3 && (
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t(($) => $.connectionDialog.authKind)}
          </label>
          <Select
            testId="connection-auth-kind"
            value={values.authKind}
            onChange={(value) => onChange('authKind', value as AuthKind)}
            options={[
              { value: 'password', label: t(($) => $.connectionDialog.authPassword) },
              { value: 'privateKey', label: t(($) => $.connectionDialog.authPrivateKey) },
              { value: 'agent', label: t(($) => $.connectionDialog.authAgent) },
            ]}
          />
        </div>
      )}

      {isPrivateKey && (
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t(($) => $.connectionDialog.privateKeyPath)}
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              data-testid="connection-private-key-path"
              value={values.privateKeyPath}
              onChange={(e) => onChange('privateKeyPath', e.target.value)}
              placeholder={t(($) => $.connectionDialog.privateKeyPathPlaceholder)}
            />
            <button
              type="button"
              onClick={onBrowsePrivateKey}
              className="px-3 rounded-md border border-input-border text-sm text-text hover:bg-input-hover-bg"
            >
              {t(($) => $.connectionDialog.browse)}
            </button>
          </div>
        </div>
      )}

      {values.authKind === 'agent' && (
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t(($) => $.connectionDialog.agentPath)}
          </label>
          <Input
            type="text"
            value={values.agentPath}
            onChange={(e) => onChange('agentPath', e.target.value)}
            placeholder={t(($) => $.connectionDialog.agentPathPlaceholder)}
          />
        </div>
      )}

      {(isPassword || isPrivateKey) && (
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {isPrivateKey
              ? t(($) => $.connectionDialog.passphrase)
              : isS3
                ? t(($) => $.connectionDialog.secretAccessKey)
                : t(($) => $.connectionDialog.password)}
          </label>
          <PasswordInput
            testId={isPrivateKey ? 'connection-passphrase' : 'connection-password'}
            value={isPrivateKey ? values.passphrase : values.password}
            onChange={(value) => onChange(isPrivateKey ? 'passphrase' : 'password', value)}
            placeholder={secretPlaceholder}
          />
        </div>
      )}

      {(isPassword || isPrivateKey) && (
        <div className="flex items-center gap-2">
          <Checkbox
            id="saveSecret"
            checked={values.saveSecret}
            onChange={(value) => onChange('saveSecret', value)}
          />
          <label htmlFor="saveSecret" className="text-sm text-text">
            {t(($) => $.connectionDialog.saveSecret)}
          </label>
        </div>
      )}
    </>
  )
}
