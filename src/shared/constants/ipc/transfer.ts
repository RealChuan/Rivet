export const TRANSFER_CHANNELS = {
  ADD: 'transfer:add',
  CANCEL: 'transfer:cancel',
  CANCEL_ALL: 'transfer:cancel-all',
  RETRY: 'transfer:retry',
  RETRY_ALL: 'transfer:retry-all',
  GET_TASKS: 'transfer:get-tasks',
  SET_CONCURRENCY: 'transfer:set-concurrency',

  TASKS_ENQUEUED: 'transfer:tasks-enqueued',
  PROGRESS: 'transfer:progress',
  TASK_COMPLETED: 'transfer:task-completed',
  TASK_FAILED: 'transfer:task-failed',
  TASK_REMOVED: 'transfer:task-removed',
  HAS_ACTIVE_TASKS: 'transfer:has-active-tasks',
} as const
