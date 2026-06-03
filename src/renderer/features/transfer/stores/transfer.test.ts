import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TransferTask } from '@shared/types/transfer.js'
import { SORT_ORDER } from '@shared/constants/sort.js'
import {
  TRANSFER_CONFIG,
  TRANSFER_SORT_FIELD,
  TRANSFER_TASK_STATUS,
} from '@shared/constants/transfer.js'
import {
  selectRunningTaskCount,
  selectSessionIds,
  selectSortedTasks,
  selectTasksBySession,
  useTransferStore,
} from './transfer.js'

const mockSetConcurrency = vi.fn()
const mockOnTasksEnqueued = vi.fn()
const mockOnProgress = vi.fn()
const mockOnTaskCompleted = vi.fn()
const mockOnTaskFailed = vi.fn()
const mockOnTaskRemoved = vi.fn()

vi.stubGlobal('window', {
  electronAPI: {
    transfer: {
      setConcurrency: mockSetConcurrency,
      onTasksEnqueued: mockOnTasksEnqueued,
      onProgress: mockOnProgress,
      onTaskCompleted: mockOnTaskCompleted,
      onTaskFailed: mockOnTaskFailed,
      onTaskRemoved: mockOnTaskRemoved,
    },
  },
})

// Mock setTimeout-based throttle for testing
let timerCallbacks: Array<() => void> = []
vi.stubGlobal('setTimeout', (cb: () => void, _ms: number) => {
  timerCallbacks.push(cb)
  return timerCallbacks.length
})
vi.stubGlobal('clearTimeout', () => {})

function flushTimers() {
  const callbacks = [...timerCallbacks]
  timerCallbacks = []
  for (const cb of callbacks) {
    cb()
  }
}

function createTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 'task-1',
    sessionId: 'session-1',
    localPath: '/local/file.txt',
    remotePath: '/remote/file.txt',
    itemName: 'file.txt',
    itemType: 'file',
    status: TRANSFER_TASK_STATUS.RUNNING,
    fileSize: 1000,
    transferredSize: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('useTransferStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    timerCallbacks = []
    useTransferStore.setState({
      tasks: [],
      taskProgress: new Map(),
      sortBy: TRANSFER_SORT_FIELD.CREATED_AT,
      sortOrder: SORT_ORDER.DESC,
      maxConcurrency: TRANSFER_CONFIG.MAX_CONCURRENCY,
      selectedSessionId: null,
      activeOperations: new Map(),
    })
  })

  describe('initial state', () => {
    it('should have empty tasks', () => {
      expect(useTransferStore.getState().tasks).toEqual([])
    })

    it('should have empty taskProgress', () => {
      expect(useTransferStore.getState().taskProgress.size).toBe(0)
    })

    it('should have default sortBy as CREATED_AT', () => {
      expect(useTransferStore.getState().sortBy).toBe(TRANSFER_SORT_FIELD.CREATED_AT)
    })

    it('should have default sortOrder as desc', () => {
      expect(useTransferStore.getState().sortOrder).toBe(SORT_ORDER.DESC)
    })

    it('should have default maxConcurrency', () => {
      expect(useTransferStore.getState().maxConcurrency).toBe(TRANSFER_CONFIG.MAX_CONCURRENCY)
    })

    it('should have null selectedSessionId', () => {
      expect(useTransferStore.getState().selectedSessionId).toBeNull()
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

    it('should set selectedSessionId to first task sessionId when null', () => {
      const task = createTask({ sessionId: 'session-abc' })
      useTransferStore.getState().handleTasksEnqueued([task])

      expect(useTransferStore.getState().selectedSessionId).toBe('session-abc')
    })

    it('should not override selectedSessionId when already set', () => {
      useTransferStore.setState({ selectedSessionId: 'session-existing' })
      const task = createTask({ sessionId: 'session-new' })
      useTransferStore.getState().handleTasksEnqueued([task])

      expect(useTransferStore.getState().selectedSessionId).toBe('session-existing')
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

      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
      })
      flushTimers()

      expect(useTransferStore.getState().taskProgress.get('task-1')?.transferredSize).toBe(500)
    })

    it('should not update tasks array on progress', () => {
      const task = createTask({ id: 'task-1', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task] })
      const originalTasksRef = useTransferStore.getState().tasks

      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
      })
      flushTimers()

      expect(useTransferStore.getState().tasks).toBe(originalTasksRef)
    })

    it('should update fileSize in taskProgress', () => {
      const task = createTask({ id: 'task-1', fileSize: 0 })
      useTransferStore.setState({ tasks: [task] })

      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
        fileSize: 1000,
      })
      flushTimers()

      expect(useTransferStore.getState().taskProgress.get('task-1')?.fileSize).toBe(1000)
    })

    it('should update folder stats in taskProgress', () => {
      const task = createTask({ id: 'task-1' })
      useTransferStore.setState({ tasks: [task] })

      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 200,
        totalFileCount: 10,
        completedFileCount: 3,
        activeFileCount: 2,
        waitingFileCount: 5,
      })
      flushTimers()

      const progress = useTransferStore.getState().taskProgress.get('task-1')
      expect(progress?.totalFileCount).toBe(10)
      expect(progress?.completedFileCount).toBe(3)
      expect(progress?.activeFileCount).toBe(2)
      expect(progress?.waitingFileCount).toBe(5)
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
      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 100,
        activeOperations: ops,
      })
      flushTimers()

      expect(useTransferStore.getState().activeOperations.get('task-1')).toEqual(ops)
    })

    it('should not modify non-matching tasks', () => {
      const task1 = createTask({ id: 'task-1', transferredSize: 0 })
      const task2 = createTask({ id: 'task-2', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task1, task2] })

      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
      })
      flushTimers()

      expect(useTransferStore.getState().taskProgress.has('task-2')).toBe(false)
    })

    it('should batch multiple progress updates into a single set call', () => {
      const task1 = createTask({ id: 'task-1', transferredSize: 0 })
      const task2 = createTask({ id: 'task-2', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task1, task2] })

      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 100,
      })
      useTransferStore.getState().handleProgress({
        taskId: 'task-2',
        transferredSize: 200,
      })
      // Before flush, state should not be updated yet
      expect(useTransferStore.getState().taskProgress.has('task-1')).toBe(false)
      expect(useTransferStore.getState().taskProgress.has('task-2')).toBe(false)

      flushTimers()

      expect(useTransferStore.getState().taskProgress.get('task-1')?.transferredSize).toBe(100)
      expect(useTransferStore.getState().taskProgress.get('task-2')?.transferredSize).toBe(200)
    })

    it('should use latest data when same task receives multiple updates in one batch', () => {
      const task = createTask({ id: 'task-1', transferredSize: 0 })
      useTransferStore.setState({ tasks: [task] })

      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 100,
      })
      useTransferStore.getState().handleProgress({
        taskId: 'task-1',
        transferredSize: 500,
      })
      flushTimers()

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
      const task = createTask({ id: 'task-1', status: TRANSFER_TASK_STATUS.RUNNING })
      useTransferStore.setState({ tasks: [task] })

      useTransferStore.getState().handleTaskFailed({
        taskId: 'task-1',
        errorMessage: 'Connection lost',
      })

      expect(useTransferStore.getState().tasks[0]?.status).toBe(TRANSFER_TASK_STATUS.FAILED)
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
      const task1 = createTask({ id: 'task-1', status: TRANSFER_TASK_STATUS.RUNNING })
      const task2 = createTask({ id: 'task-2', status: TRANSFER_TASK_STATUS.RUNNING })
      useTransferStore.setState({ tasks: [task1, task2] })

      useTransferStore.getState().handleTaskFailed({
        taskId: 'task-1',
        errorMessage: 'Error',
      })

      expect(useTransferStore.getState().tasks[1]?.status).toBe(TRANSFER_TASK_STATUS.RUNNING)
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

  describe('setSort', () => {
    it('should update sortBy and sortOrder', () => {
      useTransferStore.getState().setSort(TRANSFER_SORT_FIELD.NAME, SORT_ORDER.ASC)

      expect(useTransferStore.getState().sortBy).toBe(TRANSFER_SORT_FIELD.NAME)
      expect(useTransferStore.getState().sortOrder).toBe(SORT_ORDER.ASC)
    })
  })

  describe('setSelectedSessionId', () => {
    it('should update selectedSessionId', () => {
      useTransferStore.getState().setSelectedSessionId('session-1')

      expect(useTransferStore.getState().selectedSessionId).toBe('session-1')
    })

    it('should allow setting to null', () => {
      useTransferStore.setState({ selectedSessionId: 'session-1' })
      useTransferStore.getState().setSelectedSessionId(null)

      expect(useTransferStore.getState().selectedSessionId).toBeNull()
    })
  })

  describe('setConcurrency', () => {
    it('should update maxConcurrency in state', () => {
      useTransferStore.getState().setConcurrency(5)

      expect(useTransferStore.getState().maxConcurrency).toBe(5)
    })

    it('should call window.electronAPI.transfer.setConcurrency', () => {
      useTransferStore.getState().setConcurrency(5)

      expect(mockSetConcurrency).toHaveBeenCalledWith(5)
    })
  })

  describe('startListening', () => {
    it('should register all IPC event listeners', () => {
      useTransferStore.getState().startListening()

      expect(mockOnTasksEnqueued).toHaveBeenCalled()
      expect(mockOnProgress).toHaveBeenCalled()
      expect(mockOnTaskCompleted).toHaveBeenCalled()
      expect(mockOnTaskFailed).toHaveBeenCalled()
      expect(mockOnTaskRemoved).toHaveBeenCalled()
    })

    it('should return a cleanup function that calls all unsubscribers', () => {
      const unsub1 = vi.fn()
      const unsub2 = vi.fn()
      const unsub3 = vi.fn()
      const unsub4 = vi.fn()
      const unsub5 = vi.fn()

      mockOnTasksEnqueued.mockReturnValue(unsub1)
      mockOnProgress.mockReturnValue(unsub2)
      mockOnTaskCompleted.mockReturnValue(unsub3)
      mockOnTaskFailed.mockReturnValue(unsub4)
      mockOnTaskRemoved.mockReturnValue(unsub5)

      const cleanup = useTransferStore.getState().startListening()
      cleanup()

      expect(unsub1).toHaveBeenCalled()
      expect(unsub2).toHaveBeenCalled()
      expect(unsub3).toHaveBeenCalled()
      expect(unsub4).toHaveBeenCalled()
      expect(unsub5).toHaveBeenCalled()
    })
  })

  describe('selectors', () => {
    describe('selectSessionIds', () => {
      it('should return unique session IDs', () => {
        const task1 = createTask({ id: 'task-1', sessionId: 'session-1' })
        const task2 = createTask({ id: 'task-2', sessionId: 'session-2' })
        const task3 = createTask({ id: 'task-3', sessionId: 'session-1' })
        useTransferStore.setState({ tasks: [task1, task2, task3] })

        const ids = selectSessionIds(useTransferStore.getState())

        expect(ids).toEqual(['session-1', 'session-2'])
      })

      it('should return empty array when no tasks', () => {
        expect(selectSessionIds(useTransferStore.getState())).toEqual([])
      })
    })

    describe('selectTasksBySession', () => {
      it('should group tasks by sessionId', () => {
        const task1 = createTask({ id: 'task-1', sessionId: 'session-1' })
        const task2 = createTask({ id: 'task-2', sessionId: 'session-2' })
        const task3 = createTask({ id: 'task-3', sessionId: 'session-1' })
        useTransferStore.setState({ tasks: [task1, task2, task3] })

        const map = selectTasksBySession(useTransferStore.getState())

        expect(map.get('session-1')).toEqual([task1, task3])
        expect(map.get('session-2')).toEqual([task2])
      })

      it('should return empty map when no tasks', () => {
        const map = selectTasksBySession(useTransferStore.getState())
        expect(map.size).toBe(0)
      })
    })

    describe('selectSortedTasks', () => {
      it('should sort by createdAt descending by default', () => {
        const task1 = createTask({ id: 'task-1', createdAt: 100 })
        const task2 = createTask({ id: 'task-2', createdAt: 200 })
        useTransferStore.setState({ tasks: [task1, task2] })

        const sorted = selectSortedTasks(useTransferStore.getState())

        expect(sorted[0]?.id).toBe('task-2')
        expect(sorted[1]?.id).toBe('task-1')
      })

      it('should sort by name ascending', () => {
        const task1 = createTask({ id: 'task-1', itemName: 'zebra.txt' })
        const task2 = createTask({ id: 'task-2', itemName: 'apple.txt' })
        useTransferStore.setState({
          tasks: [task1, task2],
          sortBy: TRANSFER_SORT_FIELD.NAME,
          sortOrder: SORT_ORDER.ASC,
        })

        const sorted = selectSortedTasks(useTransferStore.getState())

        expect(sorted[0]?.id).toBe('task-2')
        expect(sorted[1]?.id).toBe('task-1')
      })
    })

    describe('selectRunningTaskCount', () => {
      it('should count tasks with RUNNING or WAITING status', () => {
        const task1 = createTask({ id: 'task-1', status: TRANSFER_TASK_STATUS.RUNNING })
        const task2 = createTask({ id: 'task-2', status: TRANSFER_TASK_STATUS.WAITING })
        const task3 = createTask({ id: 'task-3', status: TRANSFER_TASK_STATUS.FAILED })
        useTransferStore.setState({ tasks: [task1, task2, task3] })

        expect(selectRunningTaskCount(useTransferStore.getState())).toBe(2)
      })

      it('should return 0 when no active tasks', () => {
        const task = createTask({ status: TRANSFER_TASK_STATUS.FAILED })
        useTransferStore.setState({ tasks: [task] })

        expect(selectRunningTaskCount(useTransferStore.getState())).toBe(0)
      })
    })
  })
})
