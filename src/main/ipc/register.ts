import { ipcMain, type WebContents } from 'electron'
import { z } from 'zod'
import type { IpcDef, ParsedArgsOf, ResultOf } from '@shared/contract/define.js'
import type { AppError } from '@shared/domain/error.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { toAppError } from '@shared/domain/error.js'
import { logger } from '../utils/index.js'

export type Handlers<C extends Record<string, IpcDef>> = {
  [K in keyof C]: (...args: ParsedArgsOf<C[K]>) => Promise<ResultOf<C[K]>> | ResultOf<C[K]>
}

/** 需要知道是哪个窗口发来请求的通道（窗口控制）用这个签名。 */
export type SenderHandlers<C extends Record<string, IpcDef>> = {
  [K in keyof C]: (
    sender: WebContents,
    ...args: ParsedArgsOf<C[K]>
  ) => Promise<ResultOf<C[K]>> | ResultOf<C[K]>
}

/** 所有失败都走这个信封，形状与领域 `Result` 一致。 */
export function failureResult(error: AppError): {
  success: false
  value: null
  error: AppError
} {
  return { success: false, value: null, error }
}

type LooseHandler = (sender: WebContents, ...args: unknown[]) => unknown
type AnyHandlers = Record<string, LooseHandler | undefined>

function argsSchemaOf(def: IpcDef): z.ZodTuple {
  return z.tuple(def.args as unknown as [z.ZodType, ...z.ZodType[]])
}

function requireHandler(channel: string, handler: LooseHandler | undefined): LooseHandler {
  if (!handler) {
    throw new Error(`IPC 契约声明了 ${channel}，但注册时没有提供 handler`)
  }
  return handler
}

/**
 * 全仓唯一的 IPC 注册实现：校验位置参数、把异常收敛成失败信封。
 * 两个导出只在「是否把 sender 传给 handler」和「是否有返回值」上不同。
 */
function registerAll<C extends Record<string, IpcDef>>(
  contract: C,
  handlers: AnyHandlers,
  kind: 'invoke' | 'oneway',
): void {
  for (const [channel, def] of Object.entries(contract)) {
    const handler = requireHandler(channel, handlers[channel])
    const schema = argsSchemaOf(def)

    if (kind === 'oneway') {
      ipcMain.on(channel, (event, ...raw: unknown[]) => {
        const parsed = schema.safeParse(raw)
        if (!parsed.success) {
          logger.warn('IPC 参数校验失败（单向通道）', { channel })
          return
        }
        void Promise.resolve(handler(event.sender, ...parsed.data)).catch((error: unknown) => {
          logger.catch(error, { channel })
        })
      })
      continue
    }

    ipcMain.handle(channel, async (event, ...raw: unknown[]) => {
      const parsed = schema.safeParse(raw)
      if (!parsed.success) {
        logger.warn('IPC 参数校验失败', { channel, issues: parsed.error.issues })
        return failureResult({
          code: ERROR_CODE.INVALID_CONFIG,
          message: `invalid arguments: ${channel}`,
        })
      }

      try {
        return await handler(event.sender, ...parsed.data)
      } catch (error) {
        logger.catch(error, { channel })
        return failureResult(toAppError(error, ERROR_CODE.INVALID_STATE))
      }
    })
  }
}

/** 按契约注册请求/响应通道。 */
export function registerContract<C extends Record<string, IpcDef>>(
  contract: C,
  handlers: Handlers<C>,
): void {
  const loose = handlers as unknown as AnyHandlers
  const wrapped: AnyHandlers = {}
  for (const channel of Object.keys(contract)) {
    const handler = loose[channel]
    if (!handler) continue
    const callable = handler as unknown as (...args: unknown[]) => unknown
    wrapped[channel] = (_sender, ...args) => callable(...args)
  }
  registerAll(contract, wrapped, 'invoke')
}

/** 同上，但把 `event.sender` 作为第一个参数交给 handler。 */
export function registerContractWithSender<C extends Record<string, IpcDef>>(
  contract: C,
  handlers: SenderHandlers<C>,
): void {
  registerAll(contract, handlers as unknown as AnyHandlers, 'invoke')
}

/** 单向通道（`ipcMain.on`）：没有返回值，异常只记日志。 */
export function registerOneWay<C extends Record<string, IpcDef>>(
  contract: C,
  handlers: SenderHandlers<C>,
): void {
  registerAll(contract, handlers as unknown as AnyHandlers, 'oneway')
}
