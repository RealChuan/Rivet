import { describe, expect, it } from 'vitest'
import type { TransferTask } from '@shared/types/transfer.js'
import { FILE_TYPE } from '@shared/constants/index.js'
import { OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { buildQueueRows, queueRowHeight } from './TransferList.js'

const base: TransferTask = {
  id: 't1',
  sessionId: 's1',
  direction: TRANSFER_DIRECTION.UPLOAD,
  localPath: '/local/a.txt',
  remotePath: '/remote/a.txt',
  itemName: 'a.txt',
  itemType: FILE_TYPE.FILE,
  status: OPERATION_STATUS.WAITING,
  fileSize: 10,
  transferredSize: 0,
  createdAt: 0,
}

describe('buildQueueRows', () => {
  it('inserts a group row before each session and counts its tasks', () => {
    const rows = buildQueueRows(
      [
        { ...base, id: 'a1', sessionId: 's1' },
        { ...base, id: 'a2', sessionId: 's1', status: OPERATION_STATUS.FAILED },
        { ...base, id: 'b1', sessionId: 's2' },
      ],
      (sessionId) => (sessionId === 's1' ? 'Alpha' : 'Beta'),
    )

    expect(rows.map((row) => row.kind)).toEqual(['group', 'task', 'task', 'group', 'task'])
    const first = rows[0]
    if (first?.kind !== 'group') throw new Error('expected group row')
    expect(first.name).toBe('Alpha')
    expect(first.total).toBe(2)
    expect(first.running).toBe(1)
    expect(first.failed).toBe(1)
  })

  it('returns no rows for an empty list', () => {
    expect(buildQueueRows([], () => 'x')).toEqual([])
  })
})

describe('queueRowHeight', () => {
  it('uses a fixed height for group rows', () => {
    const rows = buildQueueRows([base], () => 'Alpha')
    expect(queueRowHeight(rows[0], false)).toBe(28)
  })

  it('keeps collapsed file tasks on a single compact row', () => {
    expect(queueRowHeight({ kind: 'task', task: base }, false)).toBe(35)
  })

  it('adds the path block when a file task is expanded', () => {
    expect(queueRowHeight({ kind: 'task', task: base }, true)).toBe(87)
  })

  it('reserves the full operation area for folders regardless of live data', () => {
    const folder = { ...base, itemType: FILE_TYPE.DIRECTORY }
    // 3 × 28 的子文件区 + 12 内边距：活跃子项数变化时不改高度。
    expect(queueRowHeight({ kind: 'task', task: folder }, false)).toBe(35 + 12 + 3 * 28)
    // 展开已经含内边距，只再加路径块高度。
    expect(queueRowHeight({ kind: 'task', task: folder }, true)).toBe(87 + 3 * 28)
  })

  it('falls back to a single row when the row is missing', () => {
    expect(queueRowHeight(undefined, true)).toBe(35)
  })
})
