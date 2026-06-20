import { useTranslation } from 'react-i18next'
import { Checkbox } from '@renderer/components/ui/Checkbox.js'
import Input from '@renderer/components/ui/Input.js'
import PasswordInput from '@renderer/components/ui/PasswordInput.js'
import Select from '@renderer/components/ui/Select.js'
import { cn } from '@renderer/utils/index.js'
import {
  PORT_SFTP,
  PORT_WEBDAV_HTTPS,
  PROTOCOL,
  type ProtocolType,
  SCHEME,
  type SchemeType,
} from '@shared/constants/index.js'

interface ConnectionFormFieldsProps {
  name: string
  onNameChange: (value: string) => void
  protocol: ProtocolType
  onProtocolChange: (value: string) => void
  host: string
  onHostChange: (value: string) => void
  port: string
  onPortChange: (value: string) => void
  scheme: SchemeType
  onSchemeChange: (value: SchemeType) => void
  rejectUnauthorized: boolean
  onRejectUnauthorizedChange: (value: boolean) => void
  basePath: string
  onBasePathChange: (value: string) => void
  username: string
  onUsernameChange: (value: string) => void
  password: string
  onPasswordChange: (value: string) => void
  savePassword: boolean
  onSavePasswordChange: (value: boolean) => void
}

export const ConnectionFormFields = ({
  name,
  onNameChange,
  protocol,
  onProtocolChange,
  host,
  onHostChange,
  port,
  onPortChange,
  scheme,
  onSchemeChange,
  rejectUnauthorized,
  onRejectUnauthorizedChange,
  basePath,
  onBasePathChange,
  username,
  onUsernameChange,
  password,
  onPasswordChange,
  savePassword,
  onSavePasswordChange,
}: ConnectionFormFieldsProps) => {
  const { t } = useTranslation()

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t(($) => $.connectionDialog.name)}
        </label>
        <Input
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t(($) => $.connectionDialog.namePlaceholder)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t(($) => $.connectionDialog.protocol)}
        </label>
        <Select
          value={protocol}
          onChange={onProtocolChange}
          options={[
            { value: PROTOCOL.SFTP, label: t(($) => $.connectionDialog.protocolSftp) },
            { value: PROTOCOL.WEBDAV, label: t(($) => $.connectionDialog.protocolWebdav) },
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
            value={host}
            onChange={(e) => onHostChange(e.target.value)}
            placeholder={t(($) => $.connectionDialog.hostPlaceholder)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t(($) => $.connectionDialog.port)}
          </label>
          <Input
            type="number"
            value={port}
            onChange={(e) => onPortChange(e.target.value)}
            placeholder={protocol === PROTOCOL.SFTP ? String(PORT_SFTP) : String(PORT_WEBDAV_HTTPS)}
          />
        </div>
      </div>

      {protocol === PROTOCOL.WEBDAV && (
        <>
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t(($) => $.connectionDialog.scheme)}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSchemeChange(SCHEME.HTTP)}
                className={cn(
                  'flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2',
                  scheme === SCHEME.HTTP
                    ? 'border border-accent bg-accent-light text-accent'
                    : 'border border-input-border bg-transparent text-text hover:border-input-border-hover hover:bg-input-hover-bg',
                )}
              >
                {t(($) => $.connectionDialog.schemeHttp)}
              </button>
              <button
                type="button"
                onClick={() => onSchemeChange(SCHEME.HTTPS)}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-focus-ring focus-visible:outline-offset-2 ${
                  scheme === SCHEME.HTTPS
                    ? 'border border-accent bg-accent-light text-accent'
                    : 'border border-input-border bg-transparent text-text hover:border-input-border-hover hover:bg-input-hover-bg'
                }`}
              >
                {t(($) => $.connectionDialog.schemeHttps)}
              </button>
            </div>
          </div>
          {scheme === SCHEME.HTTPS && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="rejectUnauthorized"
                checked={rejectUnauthorized}
                onChange={(e) => onRejectUnauthorizedChange(e.target.checked)}
              />
              <label htmlFor="rejectUnauthorized" className="text-sm text-text cursor-pointer">
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
              value={basePath}
              onChange={(e) => onBasePathChange(e.target.value)}
              placeholder={t(($) => $.connectionDialog.basePathPlaceholder)}
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t(($) => $.connectionDialog.username)}
        </label>
        <Input
          type="text"
          value={username}
          onChange={(e) => onUsernameChange(e.target.value)}
          placeholder={t(($) => $.connectionDialog.usernamePlaceholder)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t(($) => $.connectionDialog.password)}
        </label>
        <PasswordInput
          value={password}
          onChange={onPasswordChange}
          placeholder={t(($) => $.connectionDialog.passwordPlaceholder)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id="savePassword"
          checked={savePassword}
          onChange={(e) => onSavePasswordChange(e.target.checked)}
        />
        <label htmlFor="savePassword" className="text-sm text-text cursor-pointer">
          {t(($) => $.connectionDialog.savePassword)}
        </label>
      </div>
    </>
  )
}
