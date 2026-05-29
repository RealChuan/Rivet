import { logger } from '@main/utils/index.js'
import { DEFAULT_THEME_VALUE, ERROR_CODE, SORT_ORDER } from '@shared/constants/index.js'
import {
  createErrorInfo,
  err,
  type ErrorInfo,
  ok,
  type Result,
  type UiSettings,
} from '@shared/types/index.js'
import { isValidUiSettings } from './validation.js'

export const defaultUiSettings: UiSettings = {
  appearance: DEFAULT_THEME_VALUE,
  locale: '',
  connectionSortOrder: SORT_ORDER.NONE,
}

export function getUserInterfaceSettings(
  getFromMemory: () => UiSettings
): Result<UiSettings, ErrorInfo> {
  try {
    return ok({ ...getFromMemory() })
  } catch (error) {
    logger.catch(error, { action: 'get-ui-settings' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to get UI settings', String(error)))
  }
}

export function setUserInterfaceSettings(
  setToMemory: (settings: UiSettings) => void,
  settings: UiSettings
): Result<void, ErrorInfo> {
  try {
    if (!isValidUiSettings(settings)) {
      return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Invalid UI settings value'))
    }
    setToMemory({ ...settings })
    return ok(undefined)
  } catch (error) {
    logger.catch(error, { action: 'set-ui-settings' })
    return err(createErrorInfo(ERROR_CODE.CONFIG_ERROR, 'Failed to set UI settings', String(error)))
  }
}
