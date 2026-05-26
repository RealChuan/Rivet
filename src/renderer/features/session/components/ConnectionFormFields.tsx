import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  type ProtocolType,
  PROTOCOL_SFTP,
  PROTOCOL_WEBDAV,
  PORT_SFTP,
  PORT_WEBDAV_HTTPS,
  SCHEME_HTTP,
  SCHEME_HTTPS,
} from '@shared/constants/index.js'
import PasswordInput from '@renderer/components/ui/PasswordInput.js'
import Select from '@renderer/components/ui/Select.js'
import Input from '@renderer/components/ui/Input.js'

export interface ConnectionFormFieldsProps {
  name: string
  onNameChange: (value: string) => void
  protocol: ProtocolType
  onProtocolChange: (value: string) => void
  host: string
  onHostChange: (value: string) => void
  port: string
  onPortChange: (value: string) => void
  scheme: 'http' | 'https'
  onSchemeChange: (value: 'http' | 'https') => void
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

export const ConnectionFormFields: React.FC<ConnectionFormFieldsProps> = ({
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
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t('connectionDialog.name')}
        </label>
        <Input
          type="text"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder={t('connectionDialog.namePlaceholder')}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t('connectionDialog.protocol')}
        </label>
        <Select
          value={protocol}
          onChange={onProtocolChange}
          options={[
            { value: PROTOCOL_SFTP, label: 'SFTP' },
            { value: PROTOCOL_WEBDAV, label: 'WebDAV' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t('connectionDialog.host')}
          </label>
          <Input
            type="text"
            value={host}
            onChange={e => onHostChange(e.target.value)}
            placeholder="192.168.1.100"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text mb-1.5">
            {t('connectionDialog.port')}
          </label>
          <Input
            type="number"
            value={port}
            onChange={e => onPortChange(e.target.value)}
            placeholder={protocol === PROTOCOL_SFTP ? String(PORT_SFTP) : String(PORT_WEBDAV_HTTPS)}
          />
        </div>
      </div>

      {protocol === PROTOCOL_WEBDAV && (
        <>
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t('connectionDialog.scheme')}
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onSchemeChange(SCHEME_HTTP)}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 ${
                  scheme === SCHEME_HTTP
                    ? 'border border-accent bg-accent-light text-accent'
                    : 'border border-input-border bg-transparent text-text hover:border-input-border-hover hover:bg-input-hover-bg'
                }`}
              >
                HTTP
              </button>
              <button
                type="button"
                onClick={() => onSchemeChange(SCHEME_HTTPS)}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-150 ${
                  scheme === SCHEME_HTTPS
                    ? 'border border-accent bg-accent-light text-accent'
                    : 'border border-input-border bg-transparent text-text hover:border-input-border-hover hover:bg-input-hover-bg'
                }`}
              >
                HTTPS
              </button>
            </div>
          </div>
          {scheme === SCHEME_HTTPS && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rejectUnauthorized"
                checked={rejectUnauthorized}
                onChange={e => onRejectUnauthorizedChange(e.target.checked)}
                className="w-4 h-4 rounded border-input-border text-accent focus:ring-accent focus:ring-offset-0"
              />
              <label htmlFor="rejectUnauthorized" className="text-sm text-text cursor-pointer">
                {t('connectionDialog.rejectUnauthorized')}
              </label>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-text mb-1.5">
              {t('connectionDialog.basePath')}
            </label>
            <Input
              type="text"
              value={basePath}
              onChange={e => onBasePathChange(e.target.value)}
              placeholder="/dav/files"
            />
          </div>
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t('connectionDialog.username')}
        </label>
        <Input
          type="text"
          value={username}
          onChange={e => onUsernameChange(e.target.value)}
          placeholder={t('connectionDialog.usernamePlaceholder')}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-text mb-1.5">
          {t('connectionDialog.password')}
        </label>
        <PasswordInput
          value={password}
          onChange={onPasswordChange}
          placeholder={t('connectionDialog.passwordPlaceholder')}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="savePassword"
          checked={savePassword}
          onChange={e => onSavePasswordChange(e.target.checked)}
          className="w-4 h-4 rounded border-input-border text-accent focus:ring-accent focus:ring-offset-0"
        />
        <label htmlFor="savePassword" className="text-sm text-text cursor-pointer">
          {t('connectionDialog.savePassword')}
        </label>
      </div>
    </>
  )
}
