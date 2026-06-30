import { dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron'

import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { logger } from './index.js'

async function wrapDialog<T>(
  dialogFn: () => Promise<T>,
  action: string,
  errorMessage: string,
): Promise<Result<T, ErrorInfo>> {
  try {
    const result = await dialogFn()
    return ok(result)
  } catch (error) {
    logger.catch(error, { action })
    return err(createErrorInfo(ERROR_CODE.DIALOG_ERROR, errorMessage, String(error)))
  }
}

export async function showSaveDialog(
  options: SaveDialogOptions,
): Promise<Result<{ canceled: boolean; filePath?: string } | undefined, ErrorInfo>> {
  return wrapDialog(
    () => dialog.showSaveDialog(options),
    'show-save-dialog',
    'Failed to show save dialog',
  )
}

export async function showOpenDialog(
  options: OpenDialogOptions,
): Promise<Result<{ canceled: boolean; filePaths: string[] } | undefined, ErrorInfo>> {
  return wrapDialog(
    () => dialog.showOpenDialog(options),
    'show-open-dialog',
    'Failed to show open dialog',
  )
}
