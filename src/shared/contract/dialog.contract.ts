import { z } from 'zod'
import { defineContract } from './define.js'
import { resultSchemaOf } from './schema.js'

const openDialogOptionsSchema = z.object({
  properties: z.array(z.string()),
  defaultPath: z.string().optional(),
})

const saveDialogOptionsSchema = z.object({
  defaultPath: z.string().optional(),
})

export const dialogContract = defineContract({
  'dialog.showOpenDialog': {
    args: [openDialogOptionsSchema],
    result: resultSchemaOf(
      z.object({ canceled: z.boolean(), filePaths: z.array(z.string()) }).optional(),
    ),
  },
  'dialog.showSaveDialog': {
    args: [saveDialogOptionsSchema],
    result: resultSchemaOf(
      z.object({ canceled: z.boolean(), filePath: z.string().optional() }).optional(),
    ),
  },
})
