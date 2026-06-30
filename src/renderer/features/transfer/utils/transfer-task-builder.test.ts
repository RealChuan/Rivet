import { describe, expect, it } from 'vitest'
import { OPERATION_STATUS, TRANSFER_DIRECTION } from '@shared/constants/transfer.js'
import { FILE_TYPE } from '@shared/constants/ui.js'
import { buildDownloadTasksFromResolved, type ResolvedTask } from './transfer-task-builder.js'

describe('buildDownloadTasksFromResolved', () => {
  it('builds tasks with correct itemType for mixed file and folder selections', () => {
    const remoteItems = [
      { path: '/remote/file.txt', type: FILE_TYPE.FILE, size: 100 },
      { path: '/remote/folder', type: FILE_TYPE.DIRECTORY, size: 0 },
    ]
    const resolvedFilePaths: ResolvedTask[] = [
      { localPath: '/remote/file.txt', remotePath: '/local/file.txt', itemName: 'file.txt' },
    ]
    const resolvedFolderPaths: ResolvedTask[] = [
      { localPath: '/remote/folder', remotePath: '/local/folder', itemName: 'folder' },
    ]

    const tasks = buildDownloadTasksFromResolved(
      remoteItems,
      { resolvedFilePaths, resolvedFolderPaths },
      'session-1',
      '/local',
    )

    expect(tasks).toHaveLength(2)
    const fileTask = tasks.find((t) => t.itemType === FILE_TYPE.FILE)
    const folderTask = tasks.find((t) => t.itemType === FILE_TYPE.DIRECTORY)
    expect(fileTask).toBeDefined()
    expect(folderTask).toBeDefined()
    expect(fileTask?.direction).toBe(TRANSFER_DIRECTION.DOWNLOAD)
    expect(folderTask?.direction).toBe(TRANSFER_DIRECTION.DOWNLOAD)
    expect(fileTask?.remotePath).toBe('/remote/file.txt')
    expect(folderTask?.remotePath).toBe('/remote/folder')
    expect(fileTask?.fileSize).toBe(100)
    expect(fileTask?.status).toBe(OPERATION_STATUS.WAITING)
    expect(folderTask?.status).toBe(OPERATION_STATUS.WAITING)
  })

  it('returns empty array when no resolved paths provided', () => {
    const tasks = buildDownloadTasksFromResolved(
      [],
      { resolvedFilePaths: [], resolvedFolderPaths: [] },
      'session-1',
      '/local',
    )
    expect(tasks).toHaveLength(0)
  })

  it('builds only file tasks when no folders resolved', () => {
    const remoteItems = [
      { path: '/remote/a.txt', type: FILE_TYPE.FILE, size: 10 },
      { path: '/remote/b.txt', type: FILE_TYPE.FILE, size: 20 },
    ]
    const resolvedFilePaths: ResolvedTask[] = [
      { localPath: '/remote/a.txt', remotePath: '/local/a.txt', itemName: 'a.txt' },
      { localPath: '/remote/b.txt', remotePath: '/local/b.txt', itemName: 'b.txt' },
    ]

    const tasks = buildDownloadTasksFromResolved(
      remoteItems,
      { resolvedFilePaths, resolvedFolderPaths: [] },
      'session-1',
      '/local',
    )

    expect(tasks).toHaveLength(2)
    expect(tasks.every((t) => t.itemType === FILE_TYPE.FILE)).toBe(true)
  })

  it('defaults size to 0 when remote item not found in size map', () => {
    const resolvedFolderPaths: ResolvedTask[] = [
      { localPath: '/remote/unknown', remotePath: '/local/unknown', itemName: 'unknown' },
    ]

    const tasks = buildDownloadTasksFromResolved(
      [],
      { resolvedFilePaths: [], resolvedFolderPaths },
      'session-1',
      '/local',
    )

    expect(tasks[0]?.fileSize).toBe(0)
  })
})
