import { z } from 'zod'
import type { UiSettings } from '@shared/types/settings.js'
import {
  DEFAULT_THEME_VALUE,
  FILE_VIEW_MODE,
  PROTOCOL,
  SORT_ORDER,
  SUPPORTED_LANGUAGE,
  THEME,
  TRANSFER_CONFIG,
} from '@shared/constants/index.js'

export const CURRENT_SCHEMA_VERSION = 1

const themeValues = [THEME.LIGHT, THEME.DARK, THEME.SYSTEM] as const
const localeValues = [SUPPORTED_LANGUAGE.ZH_CN, SUPPORTED_LANGUAGE.EN_US, ''] as const
const fileViewModeValues = [FILE_VIEW_MODE.LIST, FILE_VIEW_MODE.GRID] as const
const sortOrderValues = [SORT_ORDER.NONE, SORT_ORDER.ASC, SORT_ORDER.DESC] as const
const protocolValues = [PROTOCOL.SFTP, PROTOCOL.WEBDAV] as const
const schemeValues = ['http', 'https'] as const
const authKindValues = ['password', 'privateKey', 'agent'] as const

export const themeSchema = z.enum(themeValues)
export const localeSchema = z.enum(localeValues)
export const fileViewModeSchema = z.enum(fileViewModeValues)
export const sortOrderSchema = z.enum(sortOrderValues)

export const uiSettingsSchema = z.object({
  appearance: themeSchema,
  locale: localeSchema,
})

export const defaultUiSettings: UiSettings = {
  appearance: DEFAULT_THEME_VALUE,
  locale: '',
}

export const transferSettingsSchema = z.object({
  maxUploadConcurrency: z
    .number()
    .int()
    .min(TRANSFER_CONFIG.MIN_CONCURRENCY)
    .max(TRANSFER_CONFIG.MAX_CONCURRENCY),
  maxDownloadConcurrency: z
    .number()
    .int()
    .min(TRANSFER_CONFIG.MIN_CONCURRENCY)
    .max(TRANSFER_CONFIG.MAX_CONCURRENCY),
})

export const connectionSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  protocol: z.enum(protocolValues),
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  username: z.string(),
  authKind: z.enum(authKindValues),
  privateKeyPath: z.string().optional(),
  agentPath: z.string().optional(),
  secretRef: z.string().optional(),
  basePath: z.string().optional(),
  scheme: z.enum(schemeValues).optional(),
  rejectUnauthorized: z.boolean().optional(),
})

export const settingsFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  ui: uiSettingsSchema,
  transfer: transferSettingsSchema,
  connectionSortOrder: sortOrderSchema,
})

export const connectionsFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  connections: z.array(connectionSchema),
  secrets: z.record(z.string(), z.string()),
})

export const knownHostSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  algorithm: z.string().min(1),
  fingerprint: z.string().min(1),
  createdAt: z.number(),
})

export const knownHostsFileSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  hosts: z.array(knownHostSchema),
})

export type SettingsFile = z.infer<typeof settingsFileSchema>
export type ConnectionsFile = z.infer<typeof connectionsFileSchema>
export type KnownHostsFile = z.infer<typeof knownHostsFileSchema>
export type ConnectionRecord = z.infer<typeof connectionSchema>
