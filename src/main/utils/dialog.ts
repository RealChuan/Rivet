import { dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron'
import { ERROR_CODE } from '@shared/constants/index.js'
import { createErrorInfo, err, type ErrorInfo, ok, type Result } from '@shared/types/index.js'
import { logger } from './index.js'

export async function showSaveDialog(
  options: SaveDialogOptions,
): Promise<Result<{ canceled: boolean; filePath?: string } | undefined, ErrorInfo>> {
  try {
    const result = await dialog.showSaveDialog(options)
    return ok(result)
  } catch (error) {
    logger.catch(error, { action: 'show-save-dialog' })
    return err(
      createErrorInfo(ERROR_CODE.DIALOG_ERROR, 'Failed to show save dialog', String(error)),
    )
  }
}

export async function showOpenDialog(
  options: OpenDialogOptions,
): Promise<Result<{ canceled: boolean; filePaths: string[] } | undefined, ErrorInfo>> {
  try {
    const result = await dialog.showOpenDialog(options)
    return ok(result)
  } catch (error) {
    logger.catch(error, { action: 'show-open-dialog' })
    return err(
      createErrorInfo(ERROR_CODE.DIALOG_ERROR, 'Failed to show open dialog', String(error)),
    )
  }
}
