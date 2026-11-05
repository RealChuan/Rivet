import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OperationProgressInfo, TransferTask } from '@shared/types/transfer.js'
import {
  OPERATION_STATUS,
  TRANSFER_DIRECTION,
  TRANSFER_OPERATION_TYPE,
} from '@shared/constants/transfer.js'
import { useTransferStore } from '../stores/transfer.js'
import { TransferTaskItem } from './TransferTaskItem.js'

function createTask(overrides: Partial<TransferTask> = {}): TransferTask {
  return {
    id: 'task-1',
    sessionId: 's1',
    direction: TRANSFER_DIRECTION.UPLOAD,
    localPath: '/local/file.txt',
    remotePath: '/remote/file.txt',
    itemName: 'file.txt',
    itemType: 'file',
    status: OPERATION_STATUS.RUNNING,
    fileSize: 1000,
    transferredSize: 0,
    createdAt: 0,
    ...overrides,
  }
}

const childOperation: OperationProgressInfo = {
  id: 'task-1:op:0',
  itemName: 'child.txt',
  type: TRANSFER_OPERATION_TYPE.UPLOAD,
  transferredSize: 5,
  fileSize: 10,
  status: OPERATION_STATUS.RUNNING,
}

describe('TransferTaskItem', () => {
  beforeEach(() => {
    useTransferStore.setState({
      tasks: [],
      taskProgress: new Map(),
      activeOperations: new Map(),
    })
  })

  it('shows sub-operations for folders without expanding the row', () => {
    useTransferStore.setState({
      activeOperations: new Map([['task-1', [childOperation]]]),
    })

    render(
      <TransferTaskItem
        task={createTask({ itemType: 'directory', itemName: 'folder' })}
        isExpanded={false}
        onToggleExpand={vi.fn()}
      />,
    )

    expect(screen.getByText('child.txt')).not.toBeNull()
  })

  it('does not render a progress bar for folders', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        ['task-1', { transferredSize: 5, totalFileCount: 3, completedFileCount: 1 }],
      ]),
    })

    render(
      <TransferTaskItem
        task={createTask({ itemType: 'directory', itemName: 'folder' })}
        isExpanded={false}
        onToggleExpand={vi.fn()}
      />,
    )

    expect(screen.queryByText('0%')).toBeNull()
    expect(screen.getByText('transfer.folderStats.scanning')).not.toBeNull()
  })

  it('switches to the real total once the folder scan finishes', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        [
          'task-1',
          {
            transferredSize: 5,
            totalFileCount: 3,
            completedFileCount: 1,
            scanCompleted: true,
          },
        ],
      ]),
    })

    render(
      <TransferTaskItem
        task={createTask({ itemType: 'directory', itemName: 'folder' })}
        isExpanded={false}
        onToggleExpand={vi.fn()}
      />,
    )

    expect(screen.getByText('transfer.folderStats.fileCount')).not.toBeNull()
    expect(screen.queryByText('transfer.folderStats.scanning')).toBeNull()
  })

  it('文件夹扫描结束后按字节总量显示剩余时间', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        [
          'task-1',
          {
            transferredSize: 10,
            fileSize: 100,
            speed: 10,
            totalFileCount: 3,
            completedFileCount: 1,
            scanCompleted: true,
          },
        ],
      ]),
    })

    render(
      <TransferTaskItem
        task={createTask({ itemType: 'directory', itemName: 'folder' })}
        isExpanded={false}
        onToggleExpand={vi.fn()}
      />,
    )

    // (100 - 10) / 10 = 9s
    expect(screen.getByText('9s')).not.toBeNull()
  })

  it('文件夹扫描期间不显示剩余时间', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        ['task-1', { transferredSize: 10, fileSize: 100, speed: 10, totalFileCount: 3 }],
      ]),
    })

    render(
      <TransferTaskItem
        task={createTask({ itemType: 'directory', itemName: 'folder' })}
        isExpanded={false}
        onToggleExpand={vi.fn()}
      />,
    )

    expect(screen.queryByText('9s')).toBeNull()
  })

  it('keeps file rows on the byte progress bar', () => {
    useTransferStore.setState({
      taskProgress: new Map([['task-1', { transferredSize: 500, fileSize: 1000 }]]),
    })

    render(<TransferTaskItem task={createTask()} isExpanded={false} onToggleExpand={vi.fn()} />)

    expect(screen.getByText('50%')).not.toBeNull()
  })
})
