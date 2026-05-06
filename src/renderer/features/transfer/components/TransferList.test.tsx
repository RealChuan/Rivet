import { describe, expect, it } from 'vitest'
import type { TransferTask } from '@shared/types/transfer.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { taskRowHeight } from './TransferList.js'

const base: TransferTask = {
  id: 't1',
  sessionId: 's1',
  direction: 'upload',
  localPath: '/local/a.txt',
  remotePath: '/remote/a.txt',
  itemName: 'a.txt',
  itemType: FILE_TYPE.FILE,
  status: 'waiting',
  fileSize: 10,
  transferredSize: 0,
  createdAt: 0,
}

describe('taskRowHeight', () => {
  it('uses the single-row height for files', () => {
    expect(taskRowHeight(base)).toBe(100)
  })

  it('uses the folder height for directories and falls back when undefined', () => {
    expect(taskRowHeight({ ...base, itemType: FILE_TYPE.DIRECTORY })).toBeGreaterThan(100)
    expect(taskRowHeight(undefined)).toBe(100)
  })
})
