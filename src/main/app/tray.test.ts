/* eslint-disable @typescript-eslint/unbound-method -- vitest expect() 需要分离方法引用 */
import { Menu } from 'electron'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trays } from '../../shared/test-utils/mocks/electron.js'
import { destroyTray, refreshTrayMenu, setupTray } from './tray.js'

const mocks = vi.hoisted(() => ({
  mainT: vi.fn<(key: string) => string>((key) => key),
}))

vi.mock('../i18n/index.js', () => ({ mainT: (key: string) => mocks.mainT(key) }))

/** 取最近一次下发给托盘的菜单模板。 */
const menuTemplate = () => vi.mocked(Menu.buildFromTemplate).mock.calls.at(-1)?.[0]

beforeEach(() => {
  trays.length = 0
  destroyTray()
  mocks.mainT.mockImplementation((key) => key)
})

describe('tray', () => {
  it('菜单只有显示主界面和退出两项', () => {
    setupTray({ onShow: vi.fn(), onQuit: vi.fn() })

    const template = menuTemplate()
    expect(template?.[0]?.label).toBe('tray.show')
    expect(template?.[2]?.label).toBe('tray.quit')
    expect(trays[0]?.setToolTip).toHaveBeenCalledWith('Rivet')
  })

  it('语言变化后 refreshTrayMenu 用新文案重建菜单', () => {
    setupTray({ onShow: vi.fn(), onQuit: vi.fn() })

    mocks.mainT.mockImplementation((key) => (key === 'tray.show' ? '显示主界面' : '退出'))
    refreshTrayMenu()

    expect(menuTemplate()?.[0]?.label).toBe('显示主界面')
    expect(menuTemplate()?.[2]?.label).toBe('退出')
  })

  it('菜单项与托盘点击回调接到处理器', () => {
    const handlers = { onShow: vi.fn(), onQuit: vi.fn() }
    setupTray(handlers)

    const template = menuTemplate()
    const show = template?.[0]?.click as (() => void) | undefined
    const quit = template?.[2]?.click as (() => void) | undefined
    show?.()
    quit?.()

    expect(handlers.onShow).toHaveBeenCalledTimes(1)
    expect(handlers.onQuit).toHaveBeenCalledTimes(1)

    const click = trays[0]?.on.mock.calls.find(([event]) => event === 'click')?.[1] as
      (() => void) | undefined
    click?.()
    expect(handlers.onShow).toHaveBeenCalledTimes(2)
  })

  it('重复调用只创建一个托盘，destroy 后可以重建', () => {
    setupTray({ onShow: vi.fn(), onQuit: vi.fn() })
    setupTray({ onShow: vi.fn(), onQuit: vi.fn() })
    expect(trays).toHaveLength(1)

    destroyTray()
    expect(trays[0]?.destroy).toHaveBeenCalled()

    setupTray({ onShow: vi.fn(), onQuit: vi.fn() })
    expect(trays).toHaveLength(2)
  })
})
