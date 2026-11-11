import { z } from 'zod'
import type { OperationStatus } from '../constants/transfer.js'
import type { FolderStatsProgress } from '../types/folder-stats.js'
import type { TerminalExitInfo } from '../types/terminal.js'
import type { TransferProgressData, TransferTask } from '../types/transfer.js'
import { defineEvents, type PayloadOf } from './define.js'

/**
 * 主进程 → 渲染进程的单向事件。
 * key 直接就是 IPC 通道名，订阅侧不需要再做映射。
 */
export const eventsContract = defineEvents({
  'protocol.sessionDisconnected': {
    payload: z.object({
      sessionId: z.string(),
      connectionId: z.string(),
      protocol: z.string(),
      name: z.string(),
    }),
  },
  'protocol.folderStatsProgress': {
    payload: z.custom<FolderStatsProgress & { sessionId: string }>(),
  },
  'transfer.tasksEnqueued': { payload: z.array(z.custom<TransferTask>()) },
  'transfer.progress': { payload: z.array(z.custom<TransferProgressData>()) },
  'transfer.taskCompleted': {
    payload: z.object({
      taskId: z.string(),
      transferredSize: z.number().optional(),
      fileSize: z.number().optional(),
    }),
  },
  'transfer.taskFailed': {
    payload: z.object({ taskId: z.string(), errorMessage: z.string() }),
  },
  'transfer.taskStatusChanged': {
    payload: z.object({ taskId: z.string(), status: z.custom<OperationStatus>() }),
  },
  'transfer.taskRemoved': { payload: z.object({ taskId: z.string() }) },
  /** 终端输出：原始字节，避免 chunk 边界切裂多字节字符。 */
  'terminal.data': {
    payload: z.object({ terminalId: z.string(), data: z.custom<Uint8Array>() }),
  },
  /** 终端消失的唯一信号：用户 exit、主动 close、连接错误都收敛到这里。 */
  'terminal.exit': { payload: z.custom<TerminalExitInfo>() },
  'app.closeRequested': { payload: z.object({ reason: z.enum(['close', 'quit']) }) },
  /** 退出前清临时文件可能耗时，通知渲染层盖住界面，别让用户以为卡死了。 */
  'app.cleanupStarted': { payload: z.object({}) },
  'window.stateChanged': { payload: z.object({ isMaximized: z.boolean() }) },
})

export type Events = {
  [K in keyof typeof eventsContract]: PayloadOf<(typeof eventsContract)[K]>
}

/** 事件名常量，主进程发送侧使用，避免散落字符串字面量。 */
export const EVENT_CHANNEL = {
  SESSION_DISCONNECTED: 'protocol.sessionDisconnected',
  FOLDER_STATS_PROGRESS: 'protocol.folderStatsProgress',
  TASKS_ENQUEUED: 'transfer.tasksEnqueued',
  PROGRESS: 'transfer.progress',
  TASK_COMPLETED: 'transfer.taskCompleted',
  TASK_FAILED: 'transfer.taskFailed',
  TASK_STATUS_CHANGED: 'transfer.taskStatusChanged',
  TASK_REMOVED: 'transfer.taskRemoved',
  TERMINAL_DATA: 'terminal.data',
  TERMINAL_EXIT: 'terminal.exit',
  CLOSE_REQUESTED: 'app.closeRequested',
  CLEANUP_STARTED: 'app.cleanupStarted',
  WINDOW_STATE_CHANGED: 'window.stateChanged',
} as const
