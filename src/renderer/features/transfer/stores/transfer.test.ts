import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TransferProgressData, TransferTask } from '@shared/types/transfer.js'
import { OPERATION_STATUS, TRANSFER_DIRECTION, TRANSFER_SCOPE } from '@shared/constants/transfer.js'
import { useTransferStore } from './transfer.js'

const mockOnTasksEnqueued = vi.fn()
const mockOnProgress = vi.fn()
const mockOnTaskCompleted = vi.fn()
const mockOnTaskFailed = vi.fn()
const mockOnTaskStatusChanged = vi.fn()
const mockOnTaskRemoved = vi.fn()
const mockGetTasks = vi.fn().mockResolvedValue({ success: true, value: [], error: null })
const mockGetConcurrency = vi.fn().mockResolvedValue({ success: true, value: 5, error: null })
const mockSetConcurrency = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    transfer: {
      onTasksEnqueued: mockOnTasksEnqueued,
      onProgress: mockOnProgress,
      onTaskCompleted: mockOnTaskCompleted,
      onTaskFailed: mockOnTaskFailed,
      onTaskStatusChanged: mockOnTaskStatusChanged,
      onTaskRemoved: mockOnTaskRemoved,
      getTasks: mockGetTasks,
      getConcurrency: mockGetConcurrency,
      setConcurrency: mockSetConcurrency,
    },
  },
})

function handleProgress(data: TransferProgressData): void {
  useTransferStore.getState().handleProgress([data])
}

function createTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 'task-1',
    sessionId: 'session-1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/file.txt',
    remotePath: '/remote/file.txt',
    itemName: 'file.txt',
    itemType: 'file',
    status: OPERATION_STATUS.RUNNING,
    fileSize: 1000,
    transferredSize: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('useTransferStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetConcurrency.mockResolvedValue(undefined)
    useTransferStore.setState({
      tasks: [],
      taskProgress: new Map(),
      activeOperations: new Map(),
      scope: TRANSFER_SCOPE.CURRENT,
      maxUploadConcurrency: 5,
      maxDownloadConcurrency: 5,
    })
  })

  describe('initial state', () => {
    it('should have empty tasks', () => {
      expect(useTransferStore.getState().tasks).toEqual([])
    })

    it('should have empty taskProgress', () => {
      expect(useTransferStore.getState().taskProgress.size).toBe(0)
    })

    it('should scope tasks to the current connection by default', () => {
      expect(useTransferStore.getState().scope).toBe(TRANSFER_SCOPE.CURRENT)
    })

    it('should have empty activeOperations', () => {
      expect(useTransferStore.getState().activeOperations.size).toBe(0)
    })
  })

  describe('handleTasksEnqueued', () => {
    it('should append tasks to state.tasks', () => {
      const task1 = createTask({ id: 'task-1' })
      const task2 = createTask({ id: 'task-2' })
      useTransferStore.getState().handleTasksEnqueued([task1, task2])

      expect(useTransferStore.getState().tasks).toEqual([task1, task2])
    })

    it('should populate taskProgress for enqueued tasks', () => {
      const task = createTask({ id: 'task-1', transferredSize: 100, fileSize: 1000 })
      useTransferStore.getState().handleTasksEnqueued([task])

      const progress = useTransferStore.getState().taskProgress.get('task-1')
      expect(progress?.transferredSize).toBe(100)
      expect(progress?.fileSize).toBe(1000)
    })

    it('should append to existing tasks', () => {
      const task1 = createTask({ id: 'task-1' })
      useTransferStore.getState().handleTasksEnqueued([task1])
      const task2 = createTask({ id: 'task-2' })
      useTransferStore.getState().handleTasksEnqueued([task2])

      expect(useTransferStore.getState().tasks).toHaveLength(2)
    })
  })

  describe('handleProgress', () => {
    it('should update taskProgress after timer flush', () => {
      const task = createTask({ id: 'task-1', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task] })

      handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
      })

      expect(useTransferStore.getState().taskProgress.get('task-1')?.transferredSize).toBe(500)
    })

    it('should not update tasks array on progress', () => {
      const task = createTask({ id: 'task-1', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task] })
      const originalTasksRef = useTransferStore.getState().tasks

      handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
      })

      expect(useTransferStore.getState().tasks).toBe(originalTasksRef)
    })

    it('should update fileSize in taskProgress', () => {
      const task = createTask({ id: 'task-1', fileSize: 0 })
      useTransferStore.setState({ tasks: [task] })

      handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
        fileSize: 1000,
      })

      expect(useTransferStore.getState().taskProgress.get('task-1')?.fileSize).toBe(1000)
    })

    it('should update folder stats in taskProgress', () => {
      const task = createTask({ id: 'task-1' })
      useTransferStore.setState({ tasks: [task] })

      handleProgress({
        taskId: 'task-1',
        transferredSize: 200,
        totalFileCount: 10,
        completedFileCount: 3,
        activeFileCount: 2,
        waitingFileCount: 5,
      })

      const progress = useTransferStore.getState().taskProgress.get('task-1')
      expect(progress?.totalFileCount).toBe(10)
      expect(progress?.completedFileCount).toBe(3)
      expect(progress?.activeFileCount).toBe(2)
      expect(progress?.waitingFileCount).toBe(5)
    })

    it('should carry scanCompleted through the batch', () => {
      const task = createTask({ id: 'task-1' })
      useTransferStore.setState({ tasks: [task] })

      handleProgress({
        taskId: 'task-1',
        transferredSize: 100,
        totalFileCount: 4,
        scanCompleted: true,
      })

      expect(useTransferStore.getState().taskProgress.get('task-1')?.scanCompleted).toBe(true)
    })

    it('should update activeOperations map', () => {
      const task = createTask({ id: 'task-1' })
      useTransferStore.setState({ tasks: [task] })

      const ops = [
        {
          id: 'op-1',
          itemName: 'a.txt',
          type: 'upload' as const,
          transferredSize: 100,
          fileSize: 200,
          status: 'running' as const,
        },
      ]
      handleProgress({
        taskId: 'task-1',
        transferredSize: 100,
        activeOperations: ops,
      })

      expect(useTransferStore.getState().activeOperations.get('task-1')).toEqual(ops)
    })

    it('should not modify non-matching tasks', () => {
      const task1 = createTask({ id: 'task-1', transferredSize: 0 })
      const task2 = createTask({ id: 'task-2', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task1, task2] })

      handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
      })

      expect(useTransferStore.getState().taskProgress.has('task-2')).toBe(false)
    })

    it('should batch multiple progress updates into a single set call', () => {
      const task1 = createTask({ id: 'task-1', transferredSize: 0 })
      const task2 = createTask({ id: 'task-2', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task1, task2] })

      handleProgress({
        taskId: 'task-1',
        transferredSize: 100,
      })
      // 渲染层不再缓冲：一批里的两个任务同一次 set 应用
      handleProgress({
        taskId: 'task-2',
        transferredSize: 200,
      })

      expect(useTransferStore.getState().taskProgress.get('task-1')?.transferredSize).toBe(100)
      expect(useTransferStore.getState().taskProgress.get('task-2')?.transferredSize).toBe(200)
    })

    it('should apply all entries of one batch in a single set', () => {
      const task1 = createTask({ id: 'task-1', transferredSize: 0 })
      const task2 = createTask({ id: 'task-2', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task1, task2] })

      useTransferStore.getState().handleProgress([
        { taskId: 'task-1', transferredSize: 100 },
        { taskId: 'task-2', transferredSize: 200 },
      ])

      expect(useTransferStore.getState().taskProgress.get('task-1')?.transferredSize).toBe(100)
      expect(useTransferStore.getState().taskProgress.get('task-2')?.transferredSize).toBe(200)
    })

    it('should use latest data when same task appears twice in one batch', () => {
      const task = createTask({ id: 'task-1', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task] })

      useTransferStore.getState().handleProgress([
        { taskId: 'task-1', transferredSize: 100 },
        { taskId: 'task-1', transferredSize: 500 },
      ])

      expect(useTransferStore.getState().taskProgress.get('task-1')?.transferredSize).toBe(500)
    })
  })

  describe('handleTaskCompleted', () => {
    it('should remove task immediately', () => {
      const task1 = createTask({ id: 'task-1' })
      const task2 = createTask({ id: 'task-2' })
      useTransferStore.setState({ tasks: [task1, task2] })

      useTransferStore.getState().handleTaskCompleted({ taskId: 'task-1' })

      expect(useTransferStore.getState().tasks).toHaveLength(1)
      expect(useTransferStore.getState().tasks[0]?.id).toBe('task-2')
    })

    it('should remove taskProgress entry', () => {
      const task = createTask({ id: 'task-1' })
      useTransferStore.setState({
        tasks: [task],
        taskProgress: new Map([['task-1', { transferredSize: 500 }]]),
      })

      useTransferStore.getState().handleTaskCompleted({ taskId: 'task-1' })

      expect(useTransferStore.getState().taskProgress.has('task-1')).toBe(false)
    })

    it('should remove activeOperations entry', () => {
      const task = createTask({ id: 'task-1' })
      const ops = new Map([['task-1', []]])
      useTransferStore.setState({ tasks: [task], activeOperations: ops })

      useTransferStore.getState().handleTaskCompleted({ taskId: 'task-1' })

      expect(useTransferStore.getState().activeOperations.has('task-1')).toBe(false)
    })
  })

  describe('handleTaskFailed', () => {
    it('should update task status to FAILED', () => {
      const task = createTask({ id: 'task-1', status: OPERATION_STATUS.RUNNING })
      useTransferStore.setState({ tasks: [task] })

      useTransferStore.getState().handleTaskFailed({
        taskId: 'task-1',
        errorMessage: 'Connection lost',
      })

      expect(useTransferStore.getState().tasks[0]?.status).toBe(OPERATION_STATUS.FAILED)
    })

    it('should set errorMessage on failed task', () => {
      const task = createTask({ id: 'task-1' })
      useTransferStore.setState({ tasks: [task] })

      useTransferStore.getState().handleTaskFailed({
        taskId: 'task-1',
        errorMessage: 'Disk full',
      })

      expect(useTransferStore.getState().tasks[0]?.errorMessage).toBe('Disk full')
    })

    it('should not modify other tasks', () => {
      const task1 = createTask({ id: 'task-1', status: OPERATION_STATUS.RUNNING })
      const task2 = createTask({ id: 'task-2', status: OPERATION_STATUS.RUNNING })
      useTransferStore.setState({ tasks: [task1, task2] })

      useTransferStore.getState().handleTaskFailed({
        taskId: 'task-1',
        errorMessage: 'Error',
      })

      expect(useTransferStore.getState().tasks[1]?.status).toBe(OPERATION_STATUS.RUNNING)
    })
  })

  describe('handleTaskRemoved', () => {
    it('should remove task from tasks', () => {
      const task1 = createTask({ id: 'task-1' })
      const task2 = createTask({ id: 'task-2' })
      useTransferStore.setState({ tasks: [task1, task2] })

      useTransferStore.getState().handleTaskRemoved({ taskId: 'task-1' })

      expect(useTransferStore.getState().tasks).toHaveLength(1)
      expect(useTransferStore.getState().tasks[0]?.id).toBe('task-2')
    })

    it('should remove taskProgress entry', () => {
      const task = createTask({ id: 'task-1' })
      useTransferStore.setState({
        tasks: [task],
        taskProgress: new Map([['task-1', { transferredSize: 500 }]]),
      })

      useTransferStore.getState().handleTaskRemoved({ taskId: 'task-1' })

      expect(useTransferStore.getState().taskProgress.has('task-1')).toBe(false)
    })

    it('should remove activeOperations entry', () => {
      const task = createTask({ id: 'task-1' })
      const ops = new Map([['task-1', []]])
      useTransferStore.setState({ tasks: [task], activeOperations: ops })

      useTransferStore.getState().handleTaskRemoved({ taskId: 'task-1' })

      expect(useTransferStore.getState().activeOperations.has('task-1')).toBe(false)
    })
  })

  describe('setScope', () => {
    it('should switch between current connection and all connections', () => {
      useTransferStore.getState().setScope(TRANSFER_SCOPE.ALL)
      expect(useTransferStore.getState().scope).toBe(TRANSFER_SCOPE.ALL)

      useTransferStore.getState().setScope(TRANSFER_SCOPE.CURRENT)
      expect(useTransferStore.getState().scope).toBe(TRANSFER_SCOPE.CURRENT)
    })
  })

  describe('restoreActiveTasks', () => {
    it('restores only waiting and running tasks', async () => {
      mockGetTasks.mockResolvedValueOnce({
        success: true,
        value: [
          createTask({ id: 'running', status: OPERATION_STATUS.RUNNING }),
          createTask({ id: 'waiting', status: OPERATION_STATUS.WAITING }),
          createTask({ id: 'failed', status: OPERATION_STATUS.FAILED }),
        ],
        error: null,
      })

      await useTransferStore.getState().restoreActiveTasks()

      expect(useTransferStore.getState().tasks.map((task) => task.id)).toEqual([
        'running',
        'waiting',
      ])
    })

    it('keeps the list untouched when nothing is active', async () => {
      mockGetTasks.mockResolvedValueOnce({
        success: true,
        value: [createTask({ id: 'failed', status: OPERATION_STATUS.FAILED })],
        error: null,
      })

      await useTransferStore.getState().restoreActiveTasks()

      expect(useTransferStore.getState().tasks).toEqual([])
    })
  })

  describe('setMaxUploadConcurrency', () => {
    it('should update maxUploadConcurrency and call IPC', () => {
      useTransferStore.getState().setMaxUploadConcurrency(8)

      expect(useTransferStore.getState().maxUploadConcurrency).toBe(8)
      expect(mockSetConcurrency).toHaveBeenCalledWith(8, 'upload')
    })
  })

  describe('setMaxDownloadConcurrency', () => {
    it('should update maxDownloadConcurrency and call IPC', () => {
      useTransferStore.getState().setMaxDownloadConcurrency(3)

      expect(useTransferStore.getState().maxDownloadConcurrency).toBe(3)
      expect(mockSetConcurrency).toHaveBeenCalledWith(3, 'download')
    })
  })

  describe('loadConcurrency', () => {
    it('should load concurrency from main process', async () => {
      mockGetConcurrency
        .mockResolvedValueOnce({ success: true, value: 7, error: null })
        .mockResolvedValueOnce({ success: true, value: 3, error: null })

      await useTransferStore.getState().loadConcurrency()

      expect(useTransferStore.getState().maxUploadConcurrency).toBe(7)
      expect(useTransferStore.getState().maxDownloadConcurrency).toBe(3)
    })
  })

  describe('startListening', () => {
    it('should register all IPC event listeners', () => {
      useTransferStore.getState().startListening()

      expect(mockOnTasksEnqueued).toHaveBeenCalled()
      expect(mockOnProgress).toHaveBeenCalled()
      expect(mockOnTaskCompleted).toHaveBeenCalled()
      expect(mockOnTaskFailed).toHaveBeenCalled()
      expect(mockOnTaskStatusChanged).toHaveBeenCalled()
      expect(mockOnTaskRemoved).toHaveBeenCalled()
    })

    it('should return a cleanup function that calls all unsubscribers', () => {
      const unsub1 = vi.fn()
      const unsub2 = vi.fn()
      const unsub3 = vi.fn()
      const unsub4 = vi.fn()
      const unsub5 = vi.fn()
      const unsub6 = vi.fn()

      mockOnTasksEnqueued.mockReturnValue(unsub1)
      mockOnProgress.mockReturnValue(unsub2)
      mockOnTaskCompleted.mockReturnValue(unsub3)
      mockOnTaskFailed.mockReturnValue(unsub4)
      mockOnTaskStatusChanged.mockReturnValue(unsub5)
      mockOnTaskRemoved.mockReturnValue(unsub6)

      const cleanup = useTransferStore.getState().startListening()
      cleanup()

      expect(unsub1).toHaveBeenCalled()
      expect(unsub2).toHaveBeenCalled()
      expect(unsub3).toHaveBeenCalled()
      expect(unsub4).toHaveBeenCalled()
      expect(unsub5).toHaveBeenCalled()
      expect(unsub6).toHaveBeenCalled()
    })
  })
})
