import type { z } from 'zod'

/**
 * 一个 IPC 通道的契约描述。
 * `args` 用元组表达位置参数，`result` 描述返回值。
 */
export interface IpcDef {
  readonly args: readonly z.ZodType[]
  readonly result: z.ZodType
}

/** 主进程 → 渲染进程的单向事件描述。 */
export interface EventDef {
  readonly payload: z.ZodType
}

/** 把尾部可 `undefined` 的元素转成可选元素，让调用方可以省略。 */
type OptionalizeTail<T> = T extends readonly [...infer Head, infer Tail]
  ? undefined extends Tail
    ? [...OptionalizeTail<Head>, Exclude<Tail, undefined>?]
    : T
  : T

type ArgsFromSchemas<A extends readonly z.ZodType[]> = OptionalizeTail<{
  [K in keyof A]: z.input<A[K]>
}>

/** 调用方可以传入的参数（schema 的 input 侧）。 */
export type ArgsOf<D extends IpcDef> = D['args'] extends infer A extends readonly z.ZodType[]
  ? ArgsFromSchemas<A>
  : never

type ParsedFromSchemas<A extends readonly z.ZodType[]> = {
  [K in keyof A]: z.output<A[K]>
}

/** 主进程 handler 收到的参数（schema 的 output 侧，已解析）。 */
export type ParsedArgsOf<D extends IpcDef> = D['args'] extends infer A extends readonly z.ZodType[]
  ? ParsedFromSchemas<A>
  : never

export type ResultOf<D extends IpcDef> = z.output<D['result']>

export type PayloadOf<E extends EventDef> = z.output<E['payload']>

/**
 * 声明契约。必须用 `const` 泛型，否则 `args` 字面量会退化成数组、
 * channel 名会退化成 string。
 */
export function defineContract<const T extends Record<string, IpcDef>>(contract: T): T {
  return contract
}

export function defineEvents<const T extends Record<string, EventDef>>(events: T): T {
  return events
}

/** 契约 → 一组可调用方法（扁平通道名）。 */
export type ClientOf<C extends Record<string, IpcDef>> = {
  [K in keyof C]: (...args: ArgsOf<C[K]>) => Promise<ResultOf<C[K]>>
}

/**
 * 按前缀把请求契约映射成命名空间对象的方法集合。
 * 例：`ApiOf<'protocol', InvokeContract>` 得到 `{ list, mkdir, ... }`。
 */
export type ApiOf<Prefix extends string, C extends Record<string, IpcDef>> = {
  [K in keyof C as K extends `${Prefix}.${infer M}` ? M : never]: K extends keyof C
    ? (...args: ArgsOf<C[K]>) => Promise<ResultOf<C[K]>>
    : never
}

/** 单向通道 → 同步方法（无 Promise）。 */
export type SendApiOf<Prefix extends string, C extends Record<string, IpcDef>> = {
  [K in keyof C as K extends `${Prefix}.${infer M}` ? M : never]: (...args: ArgsOf<C[K]>) => void
}

/**
 * 事件契约 → 订阅方法集合：`transfer.taskRemoved` 派生 `onTaskRemoved`。
 * payload 为 `null` 的事件（如 hasActiveTasks）回调无参数。
 */
export type EventApi<Prefix extends string, E extends Record<string, unknown>> = {
  [K in keyof E as K extends `${Prefix}.${infer M}` ? `on${Capitalize<M>}` : never]: (
    callback: E[K] extends null ? () => void : (payload: E[K]) => void,
  ) => () => void
}
