import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import type { TransferTask } from '@shared/types/transfer.js'
import { OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import { useTransferStore } from '../stores/transfer.js'
import { QueueSummary } from './QueueSummary.js'

function createTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 'task-1',
    sessionId: 's1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/folder',
    remotePath: '/remote/folder',
    itemName: 'folder',
    itemType: FILE_TYPE.DIRECTORY,
    status: OPERATION_STATUS.RUNNING,
    fileSize: 0,
    transferredSize: 0,
    createdAt: 0,
    ...overrides,
  }
}

describe('QueueSummary', () => {
  beforeEach(() => {
    useTransferStore.setState({ tasks: [], taskProgress: new Map() })
  })

  it('文件夹扫描结束前不显示剩余时间', () => {
    useTransferStore.setState({
      taskProgress: new Map([['task-1', { transferredSize: 200, fileSize: 1000, speed: 100 }]]),
    })

    render(<QueueSummary tasks={[createTask()]} showCounts={false} />)

    expect(screen.queryByText('transfer.queue.remaining')).toBeNull()
  })

  it('文件夹扫描结束后按字节总量估算剩余时间', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        ['task-1', { transferredSize: 200, fileSize: 1000, speed: 100, scanCompleted: true }],
      ]),
    })

    render(<QueueSummary tasks={[createTask()]} showCounts={false} />)

    expect(screen.getByText('transfer.queue.remaining')).not.toBeNull()
  })
})
