import type {
  LocalFileInfo,
  OperationProgressInfo,
  TransferProgressData,
  TransferTask,
} from '@shared/types/index.js'

export type TaskOutcome =
  { kind: 'completed' } | { kind: 'failed'; message: string } | { kind: 'cancelled' }

export interface ExecutorHooks {
  acquire(key: string, signal: AbortSignal): Promise<void>
  release(key: string): void
  report(data: TransferProgressData): void
  reportOperation(op: OperationProgressInfo): void
  isCancelled(taskId: string): boolean
}

/** 执行器只返回 outcome，不直接改任务状态。 */
export interface TransferExecutor {
  execute(task: TransferTask, signal: AbortSignal, hooks: ExecutorHooks): Promise<TaskOutcome>
}

/** 传输服务需要的本地文件系统子集，测试可注入内存实现。 */
export interface TaskStatPort {
  stat(path: string): Promise<{ size: number }>
  readdir(path: string): Promise<LocalFileInfo[]>
}
