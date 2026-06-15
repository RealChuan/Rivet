import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TransferTask } from '@shared/types/transfer.js'
import { ERROR_CODE } from '@shared/constants/index.js'
import { TRANSFER_CHANNELS } from '@shared/constants/ipc/transfer.js'
import {
  OPERATION_STATUS,
  TRANSFER_OPERATION_TYPE,
  TRANSFER_DIRECTION,
} from '@shared/constants/transfer.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import { createErrorInfo, err, ok } from '@shared/types/result.js'

const mockUpload = vi.fn()
const mockMkdir = vi.fn()

vi.mock('../protocol/protocol-service.js', () => ({
  protocolService: {
    upload: mockUpload,
    mkdir: mockMkdir,
  },
}))

const mockLoggerInfo = vi.fn()
const mockLoggerWarn = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('@main/utils/index.js', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
    catch: vi.fn(),
  },
}))

const mockReaddirSync = vi.fn()
const mockStatSync = vi.fn()
const mockReaddirAsync = vi.fn()
const mockStatAsync = vi.fn()

vi.mock('node:fs', () => ({
  default: {
    readdirSync: mockReaddirSync,
    statSync: mockStatSync,
    promises: {
      readdir: mockReaddirAsync,
      stat: mockStatAsync,
    },
  },
}))

let transferSettings = {
  maxUploadConcurrency: 10,
  maxDownloadConcurrency: 10,
}
const mockGetFromMemory = vi.fn().mockImplementation(() => transferSettings)
const mockSetToMemory = vi
  .fn()
  .mockImplementation((_key: string, value: typeof transferSettings) => {
    transferSettings = value
  })

vi.mock('../../stores/config/store.js', () => ({
  getFromMemory: mockGetFromMemory,
  setToMemory: mockSetToMemory,
}))

const mockSend = vi.fn()
const mockIsDestroyed = vi.fn(() => false)

function createMockMainWindow() {
  return {
    webContents: { send: mockSend },
    isDestroyed: mockIsDestroyed,
  } as unknown as Electron.BrowserWindow
}

function createFileTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: crypto.randomUUID(),
    sessionId: 'session-1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/file.txt',
    remotePath: '/remote/file.txt',
    itemName: 'file.txt',
    itemType: FILE_TYPE.FILE,
    status: OPERATION_STATUS.WAITING,
    fileSize: 1000,
    transferredSize: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

function createFolderTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: crypto.randomUUID(),
    sessionId: 'session-1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/folder',
    remotePath: '/remote/folder',
    itemName: 'folder',
    itemType: FILE_TYPE.DIRECTORY,
    status: OPERATION_STATUS.WAITING,
    fileSize: 0,
    transferredSize: 0,
    createdAt: Date.now(),
    ...overrides,
  }
}

const { TransferService } = await import('./transfer-service.js')

describe('TransferService', () => {
  let service: InstanceType<typeof TransferService>

  beforeEach(() => {
    service = new TransferService()
    service.setMainWindow(createMockMainWindow())
    vi.resetAllMocks()
    transferSettings = { maxUploadConcurrency: 10, maxDownloadConcurrency: 10 }
    mockGetFromMemory.mockImplementation(() => transferSettings)
    mockSetToMemory.mockImplementation((_key: string, value: typeof transferSettings) => {
      transferSettings = value
    })
    mockIsDestroyed.mockReturnValue(false)
  })

  afterEach(() => {
    service.cancelAll()
    vi.useRealTimers()
  })

  describe('addTasks', () => {
    it('adds file tasks and schedules them', async () => {
      mockUpload.mockResolvedValue(ok(undefined))

      const task = createFileTask()
      const result = await service.addTasks([task])

      expect(result.added).toHaveLength(1)
      expect(result.duplicates).toHaveLength(0)

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalled()
      })
    })

    it('deduplicates tasks with same sessionId + localPath + remotePath', async () => {
      const task1 = createFileTask({ id: 'id-1' })
      const task2 = createFileTask({
        id: 'id-2',
        localPath: task1.localPath,
        remotePath: task1.remotePath,
      })

      void service.addTasks([task1])
      const result = await service.addTasks([task2])

      expect(result.added).toHaveLength(0)
      expect(result.duplicates).toHaveLength(1)
    })

    it('allows different paths for same session', async () => {
      const task1 = createFileTask({ id: 'id-1' })
      const task2 = createFileTask({
        id: 'id-2',
        localPath: '/local/other.txt',
        remotePath: '/remote/other.txt',
      })

      const result = await service.addTasks([task1, task2])

      expect(result.added).toHaveLength(2)
      expect(result.duplicates).toHaveLength(0)
    })

    it('sends TASKS_ENQUEUED event', () => {
      const task = createFileTask()
      void service.addTasks([task])

      expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASKS_ENQUEUED, expect.any(Array))
    })

    it('does not send TASKS_ENQUEUED when no tasks added', () => {
      void service.addTasks([])

      expect(mockSend).not.toHaveBeenCalledWith(TRANSFER_CHANNELS.TASKS_ENQUEUED, expect.anything())
    })
  })

  describe('dual-level concurrency', () => {
    it('respects global maxConcurrency for tasks', () => {
      service.setConcurrency(2, TRANSFER_DIRECTION.UPLOAD)

      const tasks = Array.from({ length: 4 }, (_, i) =>
        createFileTask({
          id: `task-${i}`,
          localPath: `/local/file${i}.txt`,
          remotePath: `/remote/file${i}.txt`,
        })
      )

      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      void service.addTasks(tasks)

      expect(mockUpload).toHaveBeenCalledTimes(2)

      const runningTasks = service.getTasks().filter(t => t.status === OPERATION_STATUS.RUNNING)
      expect(runningTasks).toHaveLength(2)
    })

    it('folder internal ops do not consume global slots', () => {
      service.setConcurrency(3, TRANSFER_DIRECTION.UPLOAD)

      const folderTask = createFolderTask({ id: 'folder-1' })
      const fileTask1 = createFileTask({
        id: 'file-1',
        localPath: '/local/a.txt',
        remotePath: '/remote/a.txt',
      })
      const fileTask2 = createFileTask({
        id: 'file-2',
        localPath: '/local/b.txt',
        remotePath: '/remote/b.txt',
      })

      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )
      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      mockReaddirSync.mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockReaddirAsync.mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockStatSync.mockReturnValue({ size: 100 })
      mockStatAsync.mockResolvedValue({ size: 100 })

      void service.addTasks([folderTask, fileTask1, fileTask2])

      const runningTasks = service.getTasks().filter(t => t.status === OPERATION_STATUS.RUNNING)
      expect(runningTasks).toHaveLength(3)
    })

    it('releases global slot when file task completes', async () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      const task1 = createFileTask({ id: 'task-1' })
      const task2 = createFileTask({
        id: 'task-2',
        localPath: '/local/other.txt',
        remotePath: '/remote/other.txt',
      })

      let uploadResolve1: () => void = () => {}
      mockUpload
        .mockReturnValueOnce(
          new Promise<void>(resolve => {
            uploadResolve1 = resolve
          })
        )
        .mockReturnValueOnce(new Promise<void>(() => {}))

      void service.addTasks([task1, task2])

      expect(mockUpload).toHaveBeenCalledTimes(1)

      uploadResolve1()
      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('file task execution', () => {
    it('uploads file and sends completed event on success', async () => {
      mockUpload.mockResolvedValue(ok(undefined))

      const task = createFileTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledWith(
          task.sessionId,
          task.localPath,
          task.remotePath,
          expect.any(Function),
          expect.any(AbortSignal)
        )
      })

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_COMPLETED, expect.anything())
      })
    })

    it('sends failed event on upload error', async () => {
      mockUpload.mockResolvedValue(err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, 'Upload failed')))

      const task = createFileTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_FAILED, expect.anything())
      })

      const failedTask = service.getTasks().find(t => t.id === task.id)
      expect(failedTask?.status).toBe(OPERATION_STATUS.FAILED)
      expect(failedTask?.errorMessage).toBe('Upload failed')
    })

    it('removes task and sends removed event on abort when cancelled', async () => {
      mockUpload.mockImplementation(
        (
          _sessionId: string,
          _localPath: string,
          _remotePath: string,
          _onProgress: unknown,
          signal?: AbortSignal
        ) =>
          new Promise((_resolve, reject) => {
            if (signal) {
              signal.addEventListener('abort', () => {
                const abortError = new Error('The operation was aborted')
                abortError.name = 'AbortError'
                reject(abortError)
              })
            }
          })
      )

      const task = createFileTask()
      void service.addTasks([task])

      // Wait for task to start running
      await vi.waitFor(() => {
        expect(service.getTasks().find(t => t.id === task.id)?.status).toBe(
          OPERATION_STATUS.RUNNING
        )
      })

      // Cancel the task (which triggers abort)
      service.cancel(task.id)

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_REMOVED, expect.anything())
      })

      expect(service.getTasks().find(t => t.id === task.id)).toBeUndefined()
    })
  })

  describe('folder task execution', () => {
    it('creates root mkdir operation and executes it', async () => {
      let mkdirResolve: () => void = () => {}
      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          mkdirResolve = () =>
            resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )
      mockReaddirSync.mockReturnValue([])
      mockReaddirAsync.mockResolvedValue([])

      const task = createFolderTask()
      void service.addTasks([task])

      expect(mockMkdir).toHaveBeenCalledTimes(1)

      mkdirResolve()
      await vi.waitFor(() => {
        expect(mockReaddirAsync).toHaveBeenCalled()
      })
    })

    it('expands directory after mkdir success', async () => {
      mockMkdir.mockResolvedValue({
        success: true,
        value: undefined,
        error: undefined,
        requestId: 'r1',
      })
      let readdirCallCount = 0
      mockReaddirSync.mockImplementation(() => {
        readdirCallCount++
        if (readdirCallCount <= 1) {
          return [
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
            { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
          ]
        }
        return []
      })
      let readdirAsyncCallCount = 0
      mockReaddirAsync.mockImplementation(() => {
        readdirAsyncCallCount++
        if (readdirAsyncCallCount <= 1) {
          return Promise.resolve([
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
            { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
          ])
        }
        return Promise.resolve([])
      })
      mockStatSync.mockReturnValue({ size: 200 })
      mockStatAsync.mockResolvedValue({ size: 200 })
      mockUpload.mockResolvedValue(ok(undefined))

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockReaddirAsync).toHaveBeenCalled()
      })

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalled()
      })
    })

    it('fails task when mkdir fails', async () => {
      mockMkdir.mockResolvedValue({
        success: false,
        value: undefined,
        error: createErrorInfo(ERROR_CODE.MKDIR_ERROR, 'Mkdir failed'),
        requestId: 'r1',
      })

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_FAILED, expect.anything())
      })

      const failedTask = service.getTasks().find(t => t.id === task.id)
      expect(failedTask?.status).toBe(OPERATION_STATUS.FAILED)
    })
  })

  describe('fail-fast', () => {
    it('cancels all other operations when one fails', async () => {
      service.setConcurrency(3, TRANSFER_DIRECTION.UPLOAD)

      let mkdirResolve: () => void = () => {}
      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          mkdirResolve = () =>
            resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockMkdir).toHaveBeenCalledTimes(1)
      })

      mockReaddirSync.mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockReaddirAsync.mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
        { name: 'file2.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockStatSync.mockReturnValue({ size: 100 })
      mockStatAsync.mockResolvedValue({ size: 100 })

      mkdirResolve()

      await vi.waitFor(() => {
        expect(mockReaddirAsync).toHaveBeenCalled()
      })

      mockUpload.mockResolvedValueOnce(
        err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, 'Upload error'))
      )

      await vi.waitFor(() => {
        expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_FAILED, expect.anything())
      })

      const failedTask = service.getTasks().find(t => t.id === task.id)
      expect(failedTask?.status).toBe(OPERATION_STATUS.FAILED)
    })
  })

  describe('cancel', () => {
    it('cancels a waiting task', () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task1 = createFileTask({ id: 'running-task' })
      const task2 = createFileTask({
        id: 'waiting-task',
        localPath: '/other',
        remotePath: '/other',
      })

      void service.addTasks([task1, task2])

      expect(service.getTasks().find(t => t.id === 'running-task')?.status).toBe(
        OPERATION_STATUS.RUNNING
      )
      expect(service.getTasks().find(t => t.id === 'waiting-task')?.status).toBe(
        OPERATION_STATUS.WAITING
      )

      service.cancel('waiting-task')

      expect(service.getTasks().find(t => t.id === 'waiting-task')).toBeUndefined()
      expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_REMOVED, expect.anything())
    })

    it('cancels a running file task by aborting', async () => {
      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task = createFileTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1)
      })

      service.cancel(task.id)

      expect(service.getTasks().find(t => t.id === task.id)).toBeUndefined()
      expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_REMOVED, expect.anything())
    })

    it('cancels a running folder task by aborting all operations', async () => {
      let mkdirResolve: () => void = () => {}
      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          mkdirResolve = () =>
            resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockMkdir).toHaveBeenCalledTimes(1)
      })

      mockReaddirSync.mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockReaddirAsync.mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockStatSync.mockReturnValue({ size: 100 })
      mockStatAsync.mockResolvedValue({ size: 100 })
      mockUpload.mockReturnValue(new Promise<void>(() => {}))
      mkdirResolve()
      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1)
      })

      service.cancel(task.id)

      expect(service.getTasks().find(t => t.id === task.id)).toBeUndefined()
      expect(mockSend).toHaveBeenCalledWith(TRANSFER_CHANNELS.TASK_REMOVED, expect.anything())
    })

    it('does nothing for non-existent task', () => {
      service.cancel('non-existent-id')
      expect(mockSend).not.toHaveBeenCalled()
    })

    it('does not continue upload after cancelling folder task during mkdir', async () => {
      let mkdirResolve: () => void = () => {}
      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          mkdirResolve = () =>
            resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )

      mockReaddirSync.mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockReaddirAsync.mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockStatSync.mockReturnValue({ size: 100 })
      mockStatAsync.mockResolvedValue({ size: 100 })
      mockUpload.mockResolvedValue(ok(undefined))

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockMkdir).toHaveBeenCalledTimes(1)
      })

      service.cancel(task.id)

      mkdirResolve()

      await vi.waitFor(() => {
        expect(service.getTasks().find(t => t.id === task.id)).toBeUndefined()
      })

      expect(mockUpload).not.toHaveBeenCalled()
    })

    it('stops expanding subdirectories after cancelling folder task', async () => {
      mockMkdir.mockResolvedValue({
        success: true,
        value: undefined,
        error: undefined,
        requestId: 'r1',
      })

      let readdirCallCount = 0
      mockReaddirSync.mockImplementation(() => {
        readdirCallCount++
        if (readdirCallCount === 1) {
          return [
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
            { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
          ]
        }
        return []
      })
      let readdirAsyncCallCount = 0
      mockReaddirAsync.mockImplementation(() => {
        readdirAsyncCallCount++
        if (readdirAsyncCallCount === 1) {
          return Promise.resolve([
            { name: 'subdir', isDirectory: () => true, isFile: () => false },
            { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
          ])
        }
        return Promise.resolve([])
      })
      mockStatSync.mockReturnValue({ size: 100 })
      mockStatAsync.mockResolvedValue({ size: 100 })
      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1)
      })

      const uploadCallCountBefore = mockUpload.mock.calls.length

      service.cancel(task.id)

      await new Promise(resolve => setTimeout(resolve, 50))

      expect(mockUpload.mock.calls.length).toBe(uploadCallCountBefore)
    })

    it('does not double-decrement runningTasks when cancelling file task', async () => {
      service.setConcurrency(2, TRANSFER_DIRECTION.UPLOAD)

      let uploadResolve1: () => void = () => {}
      mockUpload
        .mockReturnValueOnce(
          new Promise<void>(resolve => {
            uploadResolve1 = resolve
          })
        )
        .mockResolvedValue(ok(undefined))

      const task1 = createFileTask({ id: 't1' })
      const task2 = createFileTask({ id: 't2', localPath: '/b', remotePath: '/b' })

      void service.addTasks([task1, task2])

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(2)
      })

      service.cancel('t1')

      uploadResolve1()

      await vi.waitFor(() => {
        expect(service.getTasks()).toHaveLength(0)
      })
    })

    it('does not double-decrement runningTasks when cancelling folder task', async () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      let mkdirResolve: () => void = () => {}
      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          mkdirResolve = () =>
            resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )

      const folderTask = createFolderTask({ id: 'folder-1' })
      void service.addTasks([folderTask])

      await vi.waitFor(() => {
        expect(mockMkdir).toHaveBeenCalledTimes(1)
      })

      service.cancel('folder-1')

      mkdirResolve()

      await new Promise(resolve => setTimeout(resolve, 50))

      let uploadResolve: () => void = () => {}
      mockUpload.mockReturnValueOnce(
        new Promise<void>(resolve => {
          uploadResolve = resolve
        })
      )

      const newTask = createFileTask({ id: 'new-task', localPath: '/c', remotePath: '/c' })
      void service.addTasks([newTask])

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(1)
      })

      expect(service.getTasks().find(t => t.id === 'new-task')?.status).toBe(
        OPERATION_STATUS.RUNNING
      )

      uploadResolve()
    })

    it('allows retry after cancelling a folder task', async () => {
      let mkdirResolve: () => void = () => {}
      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          mkdirResolve = () =>
            resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )

      mockReaddirSync.mockReturnValue([])
      mockReaddirAsync.mockResolvedValue([])
      mockUpload.mockResolvedValue(ok(undefined))

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockMkdir).toHaveBeenCalledTimes(1)
      })

      service.cancel(task.id)

      mkdirResolve()

      await vi.waitFor(() => {
        expect(service.getTasks().find(t => t.id === task.id)).toBeUndefined()
      })

      task.status = OPERATION_STATUS.FAILED
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(service.getTasks().find(t => t.id === task.id)).toBeDefined()
      })
    })
  })

  describe('cancelAll', () => {
    it('cancels all tasks', () => {
      service.setConcurrency(3, TRANSFER_DIRECTION.UPLOAD)

      mockUpload.mockResolvedValue(ok(undefined))

      const task1 = createFileTask({ id: 't1', localPath: '/a', remotePath: '/a' })
      const task2 = createFileTask({ id: 't2', localPath: '/b', remotePath: '/b' })

      void service.addTasks([task1, task2])

      service.cancelAll()

      expect(service.getTasks()).toHaveLength(0)
    })

    it('cancels only tasks for specified session', () => {
      service.setConcurrency(3, TRANSFER_DIRECTION.UPLOAD)

      mockUpload.mockResolvedValue(ok(undefined))

      const task1 = createFileTask({ id: 't1', sessionId: 's1', localPath: '/a', remotePath: '/a' })
      const task2 = createFileTask({ id: 't2', sessionId: 's2', localPath: '/b', remotePath: '/b' })

      void service.addTasks([task1, task2])

      service.cancelAll('s1')

      expect(service.getTasks().find(t => t.id === 't1')).toBeUndefined()
      expect(service.getTasks().find(t => t.id === 't2')).toBeDefined()
    })
  })

  describe('retry', () => {
    it('retries a failed task', async () => {
      mockUpload
        .mockResolvedValueOnce(err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, 'Upload failed')))
        .mockResolvedValue(ok(undefined))

      const task = createFileTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(service.getTasks().find(t => t.id === task.id)?.status).toBe(OPERATION_STATUS.FAILED)
      })

      service.retry(task.id)

      expect(service.getTasks().find(t => t.id === task.id)?.status).toBe(OPERATION_STATUS.RUNNING)

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(2)
      })
    })

    it('does not double-decrement runningTasks on retry', async () => {
      mockUpload.mockResolvedValue(err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, 'Upload failed')))

      const task1 = createFileTask({ id: 't1' })
      const task2 = createFileTask({ id: 't2', localPath: '/b', remotePath: '/b' })

      service.setConcurrency(2, TRANSFER_DIRECTION.UPLOAD)
      void service.addTasks([task1, task2])

      await vi.waitFor(() => {
        expect(service.getTasks().filter(t => t.status === OPERATION_STATUS.FAILED)).toHaveLength(2)
      })

      mockUpload.mockResolvedValue(ok(undefined))

      service.retry(task1.id)
      service.retry(task2.id)

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(4)
      })

      expect(service.getTasks()).toHaveLength(0)
    })

    it('does not retry a non-failed task', () => {
      const task = createFileTask()
      void service.addTasks([task])

      service.retry(task.id)

      expect(mockUpload).toHaveBeenCalledTimes(1)
    })

    it('clears old operations on retry', async () => {
      mockMkdir.mockResolvedValue({
        success: false,
        value: undefined,
        error: createErrorInfo(ERROR_CODE.MKDIR_ERROR, 'Mkdir failed'),
        requestId: 'r1',
      })

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(service.getTasks().find(t => t.id === task.id)?.status).toBe(OPERATION_STATUS.FAILED)
      })

      service.retry(task.id)

      const activeOps = service.getActiveOperations(task.id)
      expect(activeOps).toHaveLength(1)
      expect(activeOps[0]?.type).toBe(TRANSFER_OPERATION_TYPE.MKDIR)
    })
  })

  describe('retryAll', () => {
    it('retries all failed tasks', async () => {
      mockUpload.mockResolvedValue(err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, 'Upload failed')))

      const task1 = createFileTask({ id: 't1' })
      const task2 = createFileTask({ id: 't2', localPath: '/b', remotePath: '/b' })

      service.setConcurrency(2, TRANSFER_DIRECTION.UPLOAD)
      void service.addTasks([task1, task2])

      await vi.waitFor(() => {
        expect(service.getTasks().filter(t => t.status === OPERATION_STATUS.FAILED)).toHaveLength(2)
      })

      mockUpload.mockResolvedValue(ok(undefined))

      service.retryAll()

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(4)
      })
    })

    it('retries only failed tasks for specified session', async () => {
      mockUpload.mockResolvedValue(err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, 'Upload failed')))

      const task1 = createFileTask({ id: 't1', sessionId: 's1' })
      const task2 = createFileTask({ id: 't2', sessionId: 's2', localPath: '/b', remotePath: '/b' })

      service.setConcurrency(2, TRANSFER_DIRECTION.UPLOAD)
      void service.addTasks([task1, task2])

      await vi.waitFor(() => {
        expect(service.getTasks().filter(t => t.status === OPERATION_STATUS.FAILED)).toHaveLength(2)
      })

      mockUpload.mockResolvedValue(ok(undefined))

      service.retryAll('s1')

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalledTimes(3)
      })
    })
  })

  describe('getConcurrency', () => {
    it('returns upload concurrency from config store', () => {
      expect(service.getConcurrency(TRANSFER_DIRECTION.UPLOAD)).toBe(10)
    })

    it('returns download concurrency from config store', () => {
      expect(service.getConcurrency(TRANSFER_DIRECTION.DOWNLOAD)).toBe(10)
    })

    it('reflects changes after setConcurrency', () => {
      service.setConcurrency(3, TRANSFER_DIRECTION.UPLOAD)
      expect(service.getConcurrency(TRANSFER_DIRECTION.UPLOAD)).toBe(3)
    })
  })

  describe('setConcurrency', () => {
    it('clamps to TRANSFER_CONFIG.MIN_CONCURRENCY', () => {
      service.setConcurrency(0, TRANSFER_DIRECTION.UPLOAD)
      service.setConcurrency(0, TRANSFER_DIRECTION.UPLOAD)

      const task = createFileTask()
      mockUpload.mockResolvedValue(ok(undefined))

      void service.addTasks([task])

      expect(mockUpload).toHaveBeenCalled()
    })

    it('clamps to TRANSFER_CONFIG.MAX_CONCURRENCY', () => {
      service.setConcurrency(100, TRANSFER_DIRECTION.UPLOAD)

      const tasks = Array.from({ length: 15 }, (_, i) =>
        createFileTask({ id: `t${i}`, localPath: `/f${i}`, remotePath: `/f${i}` })
      )

      mockUpload.mockResolvedValue(ok(undefined))

      void service.addTasks(tasks)

      const runningTasks = service.getTasks().filter(t => t.status === OPERATION_STATUS.RUNNING)
      expect(runningTasks.length).toBeLessThanOrEqual(10)
    })

    it('triggers scheduling for waiting tasks', async () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      let uploadResolve1: () => void = () => {}
      mockUpload.mockReturnValueOnce(
        new Promise<void>(resolve => {
          uploadResolve1 = resolve
        })
      )

      const task1 = createFileTask({ id: 't1' })
      const task2 = createFileTask({ id: 't2', localPath: '/b', remotePath: '/b' })

      void service.addTasks([task1, task2])

      expect(service.getTasks().filter(t => t.status === OPERATION_STATUS.RUNNING)).toHaveLength(1)

      uploadResolve1()

      await vi.waitFor(() => {
        expect(service.getTasks().filter(t => t.status === OPERATION_STATUS.RUNNING)).toHaveLength(
          1
        )
      })
    })
  })

  describe('hasActiveTasks', () => {
    it('returns true when tasks are waiting or running', () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task1 = createFileTask({ id: 't1' })
      const task2 = createFileTask({ id: 't2', localPath: '/b', remotePath: '/b' })

      void service.addTasks([task1, task2])

      expect(service.hasActiveTasks()).toBe(true)
    })

    it('returns false when no active tasks', async () => {
      mockUpload.mockResolvedValue(ok(undefined))

      const task = createFileTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(service.getTasks()).toHaveLength(0)
      })

      expect(service.hasActiveTasks()).toBe(false)
    })

    it('filters by sessionId', () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task1 = createFileTask({ id: 't1', sessionId: 's1' })
      const task2 = createFileTask({ id: 't2', sessionId: 's2', localPath: '/b', remotePath: '/b' })
      void service.addTasks([task1, task2])

      expect(service.hasActiveTasks('s1')).toBe(true)
      expect(service.hasActiveTasks('s2')).toBe(true)
      expect(service.hasActiveTasks('s3')).toBe(false)
    })

    it('returns false for failed tasks only', async () => {
      mockUpload.mockResolvedValue(err(createErrorInfo(ERROR_CODE.UPLOAD_ERROR, 'Failed')))

      const task = createFileTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(service.getTasks().find(t => t.id === task.id)?.status).toBe(OPERATION_STATUS.FAILED)
      })

      expect(service.hasActiveTasks()).toBe(false)
    })
  })

  describe('getTasks', () => {
    it('returns all tasks without sessionId filter', () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task1 = createFileTask({ id: 't1', sessionId: 's1' })
      const task2 = createFileTask({ id: 't2', sessionId: 's2', localPath: '/b', remotePath: '/b' })

      void service.addTasks([task1, task2])

      expect(service.getTasks()).toHaveLength(2)
    })

    it('filters by sessionId', () => {
      service.setConcurrency(1, TRANSFER_DIRECTION.UPLOAD)

      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task1 = createFileTask({ id: 't1', sessionId: 's1' })
      const task2 = createFileTask({ id: 't2', sessionId: 's2', localPath: '/b', remotePath: '/b' })

      void service.addTasks([task1, task2])

      expect(service.getTasks('s1')).toHaveLength(1)
    })
  })

  describe('getActiveOperations', () => {
    it('returns running and waiting operations for a task', () => {
      mockMkdir.mockReturnValue(
        new Promise(resolve => {
          resolve({ success: true, value: undefined, error: undefined, requestId: 'r1' })
        })
      )

      const task = createFolderTask()
      void service.addTasks([task])

      const ops = service.getActiveOperations(task.id)
      expect(ops.length).toBeGreaterThanOrEqual(1)
      expect(ops[0]?.type).toBe(TRANSFER_OPERATION_TYPE.MKDIR)
    })

    it('returns empty array for non-existent task', () => {
      expect(service.getActiveOperations('non-existent')).toHaveLength(0)
    })
  })

  describe('progress reporting', () => {
    it('throttles progress events', () => {
      vi.useFakeTimers()

      mockUpload.mockImplementation(
        (
          _sid: string,
          _local: string,
          _remote: string,
          onProgress: (t: number) => void,
          _signal: AbortSignal
        ) => {
          onProgress(100)
          onProgress(200)
          onProgress(300)
          return Promise.resolve(ok(undefined))
        }
      )

      const task = createFileTask()
      void service.addTasks([task])

      const progressCalls = mockSend.mock.calls.filter(
        call => call[0] === TRANSFER_CHANNELS.PROGRESS
      )
      expect(progressCalls.length).toBeLessThanOrEqual(2)
    })

    it('sends progress with activeOperations for folder tasks', async () => {
      mockMkdir.mockResolvedValue({
        success: true,
        value: undefined,
        error: undefined,
        requestId: 'r1',
      })
      mockReaddirSync.mockReturnValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockReaddirAsync.mockResolvedValue([
        { name: 'file1.txt', isDirectory: () => false, isFile: () => true },
      ])
      mockStatSync.mockReturnValue({ size: 500 })
      mockStatAsync.mockResolvedValue({ size: 500 })

      mockUpload.mockReturnValue(new Promise<void>(() => {}))

      const task = createFolderTask()
      void service.addTasks([task])

      await vi.waitFor(() => {
        expect(mockUpload).toHaveBeenCalled()
      })

      const progressCalls = mockSend.mock.calls.filter(
        call => call[0] === TRANSFER_CHANNELS.PROGRESS
      )
      if (progressCalls.length > 0) {
        const data = progressCalls[0]?.[1] as { activeOperations?: unknown[] }
        expect(data.activeOperations).toBeDefined()
      }
    })
  })

  describe('IPC event sending', () => {
    it('does not send when mainWindow is destroyed', () => {
      mockIsDestroyed.mockReturnValue(true)

      const task = createFileTask()
      void service.addTasks([task])

      expect(mockSend).not.toHaveBeenCalled()
    })

    it('does not send when mainWindow is null', () => {
      const svc = new TransferService()

      const task = createFileTask()
      void svc.addTasks([task])

      expect(mockSend).not.toHaveBeenCalled()
    })
  })
})
