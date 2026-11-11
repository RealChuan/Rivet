import { app } from 'electron'
import path from 'node:path'
import {
  ERROR_CODE,
  SORT_ORDER,
  SUPPORTED_LANGUAGE,
  TERMINAL_FONT_SIZE,
  TRANSFER_CONFIG,
  type SortOrder,
  type SupportedLanguageLiteral,
} from '@shared/constants/index.js'
import {
  defaultUiSettings,
  favoritesSchema,
  lastPathsSchema,
  settingsFileSchema,
  type SettingsFile,
} from '@shared/schemas/config.js'
import {
  createErrorInfo,
  err,
  type ErrorInfo,
  ok,
  type Result,
  type TransferSettings,
  type UiSettings,
} from '@shared/types/index.js'
import { logger } from '../utils/index.js'
import { JsonStore } from './json-store.js'

let settingsStore: JsonStore<SettingsFile> | null = null

export function detectSystemLanguage(): SupportedLanguageLiteral {
  const locale = app.getLocale()
  return locale.toLowerCase().startsWith('zh') ? SUPPORTED_LANGUAGE.ZH_CN : SUPPORTED_LANGUAGE.EN_US
}

function defaultTransferSettings(): TransferSettings {
  return {
    maxUploadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
    maxDownloadConcurrency: TRANSFER_CONFIG.DEFAULT_CONCURRENCY,
  }
}

function requireStore(): JsonStore<SettingsFile> {
  if (!settingsStore) {
    throw new Error('settings store is not initialized')
  }
  return settingsStore
}

export function initializeSettings(baseDir: string): void {
  settingsStore = new JsonStore<SettingsFile>({
    filePath: path.join(baseDir, 'settings.json'),
    schema: settingsFileSchema,
    createDefault: () => ({
      schemaVersion: 1,
      ui: {
        ...defaultUiSettings,
        locale: detectSystemLanguage(),
      },
      transfer: defaultTransferSettings(),
      connectionSortOrder: SORT_ORDER.NONE,
      favorites: {},
      lastPaths: {},
    }),
  })
}

export function getUiSettings(): UiSettings {
  const ui = requireStore().get().ui
  if (ui.locale !== '') return ui

  const locale = detectSystemLanguage()
  requireStore().update((current) => ({ ...current, ui: { ...current.ui, locale } }))
  return { ...ui, locale }
}

export function setUiSettings(value: UiSettings): Result<void, ErrorInfo> {
  try {
    requireStore().update((current) => ({
      ...current,
      ui: {
        appearance: value.appearance,
        locale: value.locale,
        showHiddenFiles: value.showHiddenFiles,
        closeBehavior: value.closeBehavior,
        terminalFontSize: Math.min(
          TERMINAL_FONT_SIZE.MAX,
          Math.max(TERMINAL_FONT_SIZE.MIN, Math.round(value.terminalFontSize)),
        ),
      },
    }))
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-ui-settings' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Invalid UI settings value'))
  }
}

export function getFavorites(): Record<string, string[]> {
  return requireStore().get().favorites
}

export function setFavorites(value: Record<string, string[]>): Result<void, ErrorInfo> {
  const parsed = favoritesSchema.safeParse(value)
  if (!parsed.success) {
    return err(createErrorInfo(ERROR_CODE.INVALID_CONFIG, 'Invalid favorites value'))
  }

  try {
    requireStore().update((current) => ({ ...current, favorites: parsed.data }))
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-favorites' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to persist favorites'))
  }
}

export function getLastPaths(): Record<string, string> {
  return requireStore().get().lastPaths
}

export function setLastPaths(value: Record<string, string>): Result<void, ErrorInfo> {
  const parsed = lastPathsSchema.safeParse(value)
  if (!parsed.success) {
    return err(createErrorInfo(ERROR_CODE.INVALID_CONFIG, 'Invalid lastPaths value'))
  }

  try {
    requireStore().update((current) => ({ ...current, lastPaths: parsed.data }))
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-last-paths' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to persist lastPaths'))
  }
}

export function getTransferSettings(): TransferSettings {
  return requireStore().get().transfer
}

export function setTransferSettings(value: TransferSettings): Result<void, ErrorInfo> {
  const clamp = (n: number): number =>
    Math.min(TRANSFER_CONFIG.MAX_CONCURRENCY, Math.max(TRANSFER_CONFIG.MIN_CONCURRENCY, n))
  try {
    requireStore().update((current) => ({
      ...current,
      transfer: {
        maxUploadConcurrency: clamp(value.maxUploadConcurrency),
        maxDownloadConcurrency: clamp(value.maxDownloadConcurrency),
      },
    }))
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-transfer-settings' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Invalid transfer settings value'))
  }
}

export function getConnectionSortOrder(): SortOrder {
  return requireStore().get().connectionSortOrder
}

export function setConnectionSortOrder(value: SortOrder): Result<void, ErrorInfo> {
  try {
    requireStore().update((current) => ({ ...current, connectionSortOrder: value }))
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-connection-sort-order' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Invalid sort order'))
  }
}

export async function flushSettings(): Promise<void> {
  await settingsStore?.flush()
}

export async function disposeSettings(): Promise<void> {
  await settingsStore?.dispose()
  settingsStore = null
}
