import { describe, expect, it, vi } from 'vitest'
import type { Entry } from '@shared/domain/entry.js'
import type { TransferTask } from '@shared/types/index.js'
import { FILE_TYPE, OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/index.js'
import { EVENT_CHANNEL } from '@shared/contract/events.contract.js'
import type { FileProvider } from '../providers/types.js'
import type {
  ExecutorHooks,
  TaskOutcome,
  TaskStatPort,
  TransferExecutor,
} from './executor-types.js'
import { FAKE_CAPABILITIES } from '../providers/test-utils/fake-provider.js'
import { ProgressAggregator } from './progress-aggregator.js'
import { TransferService } from './transfer-service.js'

function createTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 't1',
    sessionId: 's1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/a.txt',
    localDir: '/local',
    remotePath: '/remote/a.txt',
    itemName: 'a.txt',
    itemType: FILE_TYPE.FILE,
    status: OPERATION_STATUS.WAITING,
    fileSize: 10,
    transferredSize: 0,
    createdAt: 1,
    ...overrides,
  }
}

const provider: FileProvider = {
  kind: 'sftp',
  capabilities: FAKE_CAPABILITIES,
  connect: () => Promise.resolve(),
  disconnect: () => Promise.resolve(),
  ping: () => Promise.resolve(),
  list: () =>
    (async function* () {
      await Promise.resolve()
      for (const entry of [] as Entry[]) yield entry
    })(),
  stat: () => Promise.resolve({ name: '', kind: 'file', size: 0, mtime: 0, path: '/' }),
  mkdir: () => Promise.resolve(),
  remove: () => Promise.resolve(),
  rename: () => Promise.resolve(),
  openRead: () =>
    Promise.resolve({
      stream: new ReadableStream<Uint8Array>(),
      close: () => Promise.resolve(),
    }),
  openWrite: () =>
    Promise.resolve({
      stream: new WritableStream<Uint8Array>(),
      commit: () => Promise.resolve(),
      abort: () => Promise.resolve(),
    }),
}

interface HarnessOptions {
  executor?: TransferExecutor
  maxFinishedTasks?: number
}

function makeHarness(options: HarnessOptions = {}) {
  const sent: Array<[string, unknown]> = []
  const send = vi.fn((channel: string, payload: unknown) => {
    sent.push([channel, payload])
  })
  const progress = new ProgressAggregator({
    flushMs: 1000,
    send: (batch) => send(EVENT_CHANNEL.PROGRESS, batch),
  })
  const stat = vi.fn<TaskStatPort['stat']>(() => Promise.resolve({ size: 10 }))
  const readdir = vi.fn<TaskStatPort['readdir']>(() => Promise.resolve([]))
  const localFs: TaskStatPort = { stat, readdir }
  const providedExecutor = options.executor
  const execute = vi.fn<TransferExecutor['execute']>(
    providedExecutor
      ? (task, signal, hooks) => providedExecutor.execute(task, signal, hooks)
      : () => Promise.resolve({ kind: 'completed' }),
  )
  const executor: TransferExecutor = { execute }
  const service = new TransferService({
    getProvider: () => provider,
    executor,
    localFs,
    send,
    progress,
    ...(options.maxFinishedTasks !== undefined
      ? { maxFinishedTasks: options.maxFinishedTasks }
      : {}),
  })

  const events = (channel: string): unknown[] =>
    sent.filter(([name]) => name === channel).map(([, payload]) => payload)

  return { service, execute, send, sent, events, localFs, stat, readdir, progress }
}

function resolved(outcome: TaskOutcome): Promise<TaskOutcome> {
  return Promise.resolve(outcome)
}

describe('TransferService.addTasks', () => {
  it('并发 addTasks 同一文件只入队一次，其余进 duplicates', async () => {
    const harness = makeHarness({
      executor: { execute: vi.fn(() => new Promise<TaskOutcome>(() => {})) },
    })

    const results = await Promise.all(
      Array.from({ length: 10 }, () => harness.service.addTasks([createTask()])),
    )

    expect(results.reduce((sum, result) => sum + result.added.length, 0)).toBe(1)
    expect(results.reduce((sum, result) => sum + result.duplicates.length, 0)).toBe(9)
    expect(harness.service.getTasks()).toHaveLength(1)
  })

  it('stat 失败仍保留任务，fileSize 为 0', async () => {
    const harness = makeHarness({
      executor: { execute: vi.fn(() => new Promise<TaskOutcome>(() => {})) },
    })
    harness.stat.mockRejectedValue(new Error('missing'))

    await harness.service.addTasks([createTask({ fileSize: 0 })])

    const tasks = harness.service.getTasks()
    expect(tasks).toHaveLength(1)
    expect(tasks[0]?.fileSize).toBe(0)
  })
})

describe('TransferService 状态机', () => {
  it('queued → running → completed，且完成前 flush 进度', async () => {
    let statusAtEntry: string | undefined
    let finish: ((outcome: TaskOutcome) => void) | undefined
    const execute = vi.fn<TransferExecutor['execute']>((task) => {
      statusAtEntry = task.status
      return new Promise<TaskOutcome>((resolve) => {
        finish = resolve
      })
    })
    const harness = makeHarness({ executor: { execute } })
    const flush = vi.spyOn(harness.progress, 'flush')

    await harness.service.addTasks([createTask()])
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
    expect(statusAtEntry).toBe(OPERATION_STATUS.RUNNING)

    finish?.({ kind: 'completed' })

    await vi.waitFor(() => expect(harness.service.getTasks()).toHaveLength(0))
    expect(flush).toHaveBeenCalled()
    expect(harness.events(EVENT_CHANNEL.TASK_COMPLETED)).toEqual([
      expect.objectContaining({ taskId: 't1' }),
    ])
    expect(harness.service.hasActiveTasks()).toBe(false)
  })

  it('失败保留任务并发送 taskFailed，失败任务不算活跃', async () => {
    const harness = makeHarness({
      executor: { execute: vi.fn(() => resolved({ kind: 'failed', message: 'boom' })) },
    })
    const flush = vi.spyOn(harness.progress, 'flush')

    await harness.service.addTasks([createTask()])

    await vi.waitFor(() => {
      expect(harness.service.getTasks()[0]?.status).toBe(OPERATION_STATUS.FAILED)
    })
    expect(harness.service.getTasks()[0]?.errorMessage).toBe('boom')
    expect(flush).toHaveBeenCalled()
    expect(harness.events(EVENT_CHANNEL.TASK_FAILED)).toEqual([
      expect.objectContaining({ taskId: 't1', errorMessage: 'boom' }),
    ])
    expect(harness.service.hasActiveTasks()).toBe(false)
  })

  it('失败任务超过上限时淘汰最旧的并发送 taskRemoved', async () => {
    const harness = makeHarness({
      executor: { execute: vi.fn(() => resolved({ kind: 'failed', message: 'boom' })) },
      maxFinishedTasks: 2,
    })

    for (let index = 0; index < 3; index += 1) {
      await harness.service.addTasks([
        createTask({
          id: `t${index}`,
          localPath: `/local/${index}.txt`,
          remotePath: `/remote/${index}.txt`,
          createdAt: index,
        }),
      ])
      await vi.waitFor(() => {
        expect(harness.service.getTasks().find((task) => task.id === `t${index}`)?.status).toBe(
          OPERATION_STATUS.FAILED,
        )
      })
    }

    expect(harness.service.getTasks().map((task) => task.id)).toEqual(['t1', 't2'])
    expect(harness.events(EVENT_CHANNEL.TASK_REMOVED)).toContainEqual({ taskId: 't0' })
  })

  it('retry 把失败任务重新排队并执行', async () => {
    let attempt = 0
    const execute = vi.fn<TransferExecutor['execute']>(() => {
      attempt += 1
      return resolved(attempt === 1 ? { kind: 'failed', message: 'once' } : { kind: 'completed' })
    })
    const harness = makeHarness({ executor: { execute } })

    await harness.service.addTasks([createTask()])
    await vi.waitFor(() => {
      expect(harness.service.getTasks()[0]?.status).toBe(OPERATION_STATUS.FAILED)
    })

    await harness.service.retry('t1')

    await vi.waitFor(() => expect(harness.service.getTasks()).toHaveLength(0))
    expect(execute).toHaveBeenCalledTimes(2)
  })
})

describe('TransferService 取消', () => {
  it('取消排队任务不启动 executor', async () => {
    const execute = vi.fn(() => new Promise<TaskOutcome>(() => {}))
    const harness = makeHarness({ executor: { execute } })
    harness.service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

    await harness.service.addTasks([createTask({ id: 't1' })])
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    await harness.service.addTasks([
      createTask({ id: 't2', localPath: '/local/b.txt', remotePath: '/remote/b.txt' }),
    ])
    expect(harness.service.getTasks().find((task) => task.id === 't2')?.status).toBe(
      OPERATION_STATUS.WAITING,
    )

    await harness.service.cancel('t2')

    await vi.waitFor(() => {
      expect(harness.service.getTasks().map((task) => task.id)).toEqual(['t1'])
    })
    expect(execute).toHaveBeenCalledTimes(1)
    expect(harness.events(EVENT_CHANNEL.TASK_REMOVED)).toContainEqual({ taskId: 't2' })
  })

  it('取消运行中任务会 abort signal、移除任务并发送 taskRemoved', async () => {
    let observedSignal: AbortSignal | undefined
    const execute = vi.fn<TransferExecutor['execute']>((_task, signal) => {
      observedSignal = signal
      return new Promise<TaskOutcome>((resolve) => {
        signal.addEventListener('abort', () => resolve({ kind: 'cancelled' }), { once: true })
      })
    })
    const harness = makeHarness({ executor: { execute } })

    await harness.service.addTasks([createTask()])
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())

    await harness.service.cancel('t1')

    await vi.waitFor(() => expect(harness.service.getTasks()).toHaveLength(0))
    expect(observedSignal?.aborted).toBe(true)
    expect(harness.events(EVENT_CHANNEL.TASK_REMOVED)).toContainEqual({ taskId: 't1' })
  })
})

describe('TransferService 并发与本地辅助', () => {
  it('setConcurrency 立即增大信号量容量', async () => {
    const execute = vi.fn(() => new Promise<TaskOutcome>(() => {}))
    const harness = makeHarness({ executor: { execute } })
    harness.service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

    await harness.service.addTasks([createTask({ id: 't1' })])
    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(1))
    await harness.service.addTasks([
      createTask({ id: 't2', localPath: '/local/b.txt', remotePath: '/remote/b.txt' }),
    ])
    expect(execute).toHaveBeenCalledTimes(1)

    harness.service.setConcurrency(2, TRANSFER_DIRECTION.UPLOAD)

    await vi.waitFor(() => expect(execute).toHaveBeenCalledTimes(2))
    expect(harness.service.getConcurrency(TRANSFER_DIRECTION.UPLOAD)).toBe(2)
  })

  it('checkLocalFiles 委托 localFs，读失败返回空数组', async () => {
    const harness = makeHarness()
    harness.readdir.mockResolvedValue([{ name: 'a.txt', size: 0, type: FILE_TYPE.FILE }])

    expect(await harness.service.checkLocalFiles('/local')).toEqual([
      { name: 'a.txt', size: 0, type: FILE_TYPE.FILE },
    ])

    harness.readdir.mockRejectedValue(new Error('denied'))
    expect(await harness.service.checkLocalFiles('/local')).toEqual([])
  })

  it('getLastDir/setLastDir 使用内存映射', () => {
    const harness = makeHarness()
    expect(harness.service.getLastDir('lastUploadDir')).toBeNull()
    harness.service.setLastDir('lastUploadDir', '/downloads')
    expect(harness.service.getLastDir('lastUploadDir')).toBe('/downloads')
  })

  it('执行器拿到的 hooks 可查询取消状态并上报操作进度', async () => {
    let hooks: ExecutorHooks | undefined
    let finish: ((outcome: TaskOutcome) => void) | undefined
    const execute = vi.fn<TransferExecutor['execute']>((_task, _signal, passedHooks) => {
      hooks = passedHooks
      return new Promise<TaskOutcome>((resolve) => {
        finish = resolve
      })
    })
    const harness = makeHarness({ executor: { execute } })

    await harness.service.addTasks([createTask()])
    await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())

    hooks?.reportOperation({
      id: 'op1',
      itemName: 'a.txt',
      type: 'upload',
      transferredSize: 5,
      fileSize: 10,
      status: OPERATION_STATUS.RUNNING,
    })
    hooks?.report({ taskId: 't1', transferredSize: 5 })
    hooks?.reportOperation({
      id: 'op1',
      itemName: 'a.txt',
      type: 'upload',
      transferredSize: 8,
      fileSize: 10,
      status: OPERATION_STATUS.RUNNING,
    })
    hooks?.report({ taskId: 't1', transferredSize: 8 })
    harness.progress.flush()

    expect(harness.events(EVENT_CHANNEL.PROGRESS).at(-1)).toEqual([
      expect.objectContaining({
        taskId: 't1',
        transferredSize: 8,
        activeOperations: [expect.objectContaining({ id: 'op1', transferredSize: 8 })],
      }),
    ])
    expect(harness.service.getTasks()[0]?.transferredSize).toBe(0)
    expect(hooks?.isCancelled('t1')).toBe(false)

    await harness.service.cancel('t1')
    expect(hooks?.isCancelled('t1')).toBe(true)
    finish?.({ kind: 'cancelled' })
    await vi.waitFor(() => expect(harness.service.getTasks()).toHaveLength(0))
  })
})
