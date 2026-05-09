import { create } from 'zustand'
import { TransferTask, FileInfo } from '../../shared/types.js'
import { v4 as uuidv4 } from 'uuid'

interface QueueStore {
  tasks: TransferTask[]
  addTask: (
    sessionId: string,
    type: 'upload' | 'download',
    localPath: string,
    remotePath: string,
    file?: FileInfo
  ) => TransferTask
  removeTask: (taskId: string) => void
  updateTaskProgress: (taskId: string, progress: number) => void
  completeTask: (taskId: string) => void
  failTask: (taskId: string, error: string) => void
  setTaskStatus: (taskId: string, status: TransferTask['status']) => void
  clearCompletedTasks: () => void
  getActiveTasks: () => TransferTask[]
  getPendingTasks: () => TransferTask[]
}

export const useQueueStore = create<QueueStore>((set, get) => ({
  tasks: [],

  addTask: (sessionId, type, localPath, remotePath, file?) => {
    const task: TransferTask = {
      id: uuidv4(),
      sessionId,
      type,
      localPath,
      remotePath,
      file,
      status: 'pending',
      progress: 0,
    }

    set(state => ({
      tasks: [...state.tasks, task],
    }))

    return task
  },

  removeTask: taskId => {
    set(state => ({
      tasks: state.tasks.filter(t => t.id !== taskId),
    }))
  },

  updateTaskProgress: (taskId, progress) => {
    set(state => ({
      tasks: state.tasks.map(t => (t.id === taskId ? { ...t, progress, status: 'active' } : t)),
    }))
  },

  completeTask: taskId => {
    set(state => ({
      tasks: state.tasks.map(t =>
        t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t
      ),
    }))
  },

  failTask: (taskId, error) => {
    set(state => ({
      tasks: state.tasks.map(t => (t.id === taskId ? { ...t, status: 'failed', error } : t)),
    }))
  },

  setTaskStatus: (taskId, status) => {
    set(state => ({
      tasks: state.tasks.map(t => (t.id === taskId ? { ...t, status } : t)),
    }))
  },

  clearCompletedTasks: () => {
    set(state => ({
      tasks: state.tasks.filter(t => t.status !== 'completed'),
    }))
  },

  getActiveTasks: () => {
    return get().tasks.filter(t => t.status === 'active')
  },

  getPendingTasks: () => {
    return get().tasks.filter(t => t.status === 'pending')
  },
}))

export default useQueueStore
