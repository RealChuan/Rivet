import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { TransferTask } from '@shared/types/index.js'
import { Notification, notifications } from '../../shared/test-utils/mocks/electron.js'
import { notifyTransferFinished, shouldNotify } from './notifications.js'

const mocks = vi.hoisted(() => ({
  getMainWindow: vi.fn(),
  mainT: vi.fn<(key: string) => string>((key) => key),
}))

vi.mock('./main-window.js', () => ({ getMainWindow: (): unknown => mocks.getMainWindow() }))
vi.mock('../i18n/index.js', () => ({ mainT: (key: string): string => mocks.mainT(key) }))

const fakeWindow = (focused: boolean, visible = true) => ({
  isFocused: () => focused,
  isVisible: () => visible,
  show: vi.fn(),
  focus: vi.fn(),
})

const TASK: TransferTask = {
  id: 't1',
  sessionId: 's1',
  direction: 'upload',
  localPath: '/tmp/a.txt',
  remotePath: '/a.txt',
  itemName: 'a.txt',
  itemType: 'file',
  status: 'completed',
  fileSize: 10,
  transferredSize: 10,
  createdAt: 0,
}

beforeEach(() => {
  notifications.length = 0
  Notification.isSupported.mockReturnValue(true)
})

describe('shouldNotify', () => {
  it('没有窗口时不通知', () => {
    mocks.getMainWindow.mockReturnValue(undefined)
    expect(shouldNotify()).toBe(false)
  })

  it('窗口可见且聚焦时不通知', () => {
    mocks.getMainWindow.mockReturnValue(fakeWindow(true))
    expect(shouldNotify()).toBe(false)
  })

  it('窗口隐藏或失焦时通知', () => {
    mocks.getMainWindow.mockReturnValue(fakeWindow(false))
    expect(shouldNotify()).toBe(true)

    mocks.getMainWindow.mockReturnValue(fakeWindow(true, false))
    expect(shouldNotify()).toBe(true)
  })
})

describe('notifyTransferFinished', () => {
  beforeEach(() => {
    mocks.getMainWindow.mockReturnValue(fakeWindow(false))
    mocks.mainT.mockImplementation((key) =>
      key === 'notification.completed' ? '传输完成' : '传输失败',
    )
  })

  it('完成时用本地化标题和条目名', () => {
    notifyTransferFinished(TASK, 'completed')

    expect(notifications).toHaveLength(1)
    expect(notifications[0]?.title).toBe('传输完成')
    expect(notifications[0]?.body).toBe('a.txt')
    expect(notifications[0]?.show).toHaveBeenCalled()
  })

  it('失败时把错误信息附在正文里', () => {
    notifyTransferFinished({ ...TASK, errorMessage: 'disk full' }, 'failed')

    expect(notifications[0]?.title).toBe('传输失败')
    expect(notifications[0]?.body).toBe('a.txt: disk full')
  })

  it('系统不支持通知时什么都不做', () => {
    Notification.isSupported.mockReturnValue(false)

    notifyTransferFinished(TASK, 'completed')

    expect(notifications).toHaveLength(0)
  })
})
