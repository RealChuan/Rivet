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
    expect(screen.getByText('transfer.folderStats.fileCount')).not.toBeNull()
  })

  it('文件夹扫描期同时显示已完成/已发现字节与文件计数，扫描状态落在剩余列', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        [
          'task-1',
          {
            transferredSize: 512,
            fileSize: 2048,
            totalFileCount: 3,
            completedFileCount: 1,
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

    expect(screen.getByText('512 B/2 KB')).not.toBeNull()
    // 计数列只有一种紧凑格式，扫描期与结束后一致。
    expect(screen.getByText('transfer.folderStats.fileCount')).not.toBeNull()
    expect(screen.getByText('transfer.status.scanning')).not.toBeNull()
  })

  it('文件夹行的每个数据格都带 hover tooltip', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        [
          'task-1',
          {
            transferredSize: 1024,
            fileSize: 4096,
            speed: 1024,
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

    const titleOf = (text: string): string | null => screen.getByText(text).getAttribute('title')

    expect(titleOf('folder')).toBe('folder')
    expect(titleOf('1 KB/4 KB')).toBe('1 KB/4 KB')
    expect(titleOf('transfer.folderStats.fileCount')).toBe('transfer.folderStats.fileCount')
    expect(titleOf('1 KB/s')).toBe('1 KB/s')
    // (4096 - 1024) / 1024 = 3s
    expect(titleOf('3s')).toBe('3s')
  })

  it('子操作行的数据格也带 hover tooltip', () => {
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

    expect(screen.getByText('5 B/10 B').getAttribute('title')).toBe('5 B/10 B')
    expect(screen.getByText('child.txt').closest('[title]')?.getAttribute('title')).toBe(
      'child.txt',
    )
  })

  it('文件夹扫描结束后字节按真总量显示', () => {
    useTransferStore.setState({
      taskProgress: new Map([
        [
          'task-1',
          {
            transferredSize: 1024,
            fileSize: 4096,
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

    expect(screen.getByText('1 KB/4 KB')).not.toBeNull()
    expect(screen.getByText('transfer.folderStats.fileCount')).not.toBeNull()
  })

  it('文件夹扫描结束后剩余列换回剩余时间', () => {
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

    // (100 - 10) / 10 = 9s，扫描结束后剩余列换回剩余时间。
    expect(screen.getByText('9s')).not.toBeNull()
    expect(screen.queryByText('transfer.status.scanning')).toBeNull()
  })

  it('文件夹扫描期间剩余列显示扫描中而非剩余时间', () => {
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

    expect(screen.getByText('transfer.status.scanning')).not.toBeNull()
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
