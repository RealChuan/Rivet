import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Locator,
  type Page,
} from '@playwright/test'

/** 终端复用 SFTP 会话的主机与端口，这里连 compose 里 sftp 与 shell 同端口的 ssh 服务；其余用 RIVET_E2E_* 覆盖。 */
const E2E_HOST = process.env.RIVET_E2E_HOST ?? '127.0.0.1'
const E2E_PORT = process.env.RIVET_E2E_SHELL_PORT ?? '2223'
const E2E_USER = process.env.RIVET_E2E_SHELL_USER ?? 'testuser'
const E2E_PASSWORD = process.env.RIVET_E2E_SHELL_PASSWORD ?? 'testpass'

let app: ElectronApplication
let page: Page
let userDataDir: string

async function connectSftp(): Promise<void> {
  await page.getByTestId('connection-new').click()
  await expect(page.getByTestId('connection-dialog')).toBeVisible()
  await page.getByTestId('connection-name').fill('E2E Terminal')
  await page.getByTestId('connection-host').fill(E2E_HOST)
  await page.getByTestId('connection-port').fill(E2E_PORT)
  await page.getByTestId('connection-username').fill(E2E_USER)
  await page.getByTestId('connection-password').fill(E2E_PASSWORD)
  await page.getByTestId('connection-save').click()
  await expect(page.getByTestId('host-key-confirm')).toBeVisible()
  await page.getByTestId('host-key-confirm').click()
  await expect(page.getByTestId('connection-dialog')).toBeHidden()

  await page.getByTestId('connection-item').first().click()
  await expect(page.getByTestId('toolbar-refresh').filter({ visible: true })).toBeVisible()
}

/** xterm 的可见文本在 `.xterm-rows` 里；用它判断提示符与命令输出。 */
function terminalRows(): Locator {
  return page.locator('.xterm-rows').filter({ visible: true })
}

/** 多标签下每个标签一个面板，只有激活的那个可见。 */
function terminalPanel(): Locator {
  return page.getByTestId('terminal-panel').filter({ visible: true })
}

test.describe.serial('terminal', () => {
  test.beforeAll(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'rivet-e2e-terminal-'))
    app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] })
    page = await app.firstWindow()
    await expect(page.getByTestId('connection-page')).toBeVisible()
    await connectSftp()
  })

  test.afterAll(async () => {
    await app.close()
    rmSync(userDataDir, { recursive: true, force: true })
  })

  test('runs a command in an embedded shell', async () => {
    await page.getByTestId('toolbar-terminal').filter({ visible: true }).click()
    await expect(terminalPanel()).toBeVisible()
    // 打开抽屉就该有一条「终端 1」。
    await expect(page.getByTestId('terminal-tab-1')).toBeVisible()

    const rows = terminalRows()
    // 等提示符出现：说明 shell 通道与首屏输出都通了。
    await expect
      .poll(async () => (await rows.innerText()).trim().length, { timeout: 30_000 })
      .toBeGreaterThan(0)

    await terminalPanel().click()
    // 用算术表达式生成标记：敲进去的字符里不含 rivet-42，只有 shell 输出才会出现。
    await page.keyboard.type('echo rivet-$((6*7))')
    await page.keyboard.press('Enter')

    await expect.poll(async () => rows.innerText(), { timeout: 30_000 }).toContain('rivet-42')
  })

  test('keeps a second tab on its own shell', async () => {
    await page.getByTestId('terminal-tab-new').click()
    await expect(page.getByTestId('terminal-tab-2')).toHaveAttribute('aria-pressed', 'true')

    const rows = terminalRows()
    await expect
      .poll(async () => (await rows.innerText()).trim().length, { timeout: 30_000 })
      .toBeGreaterThan(0)

    await terminalPanel().click()
    await page.keyboard.type('echo second-$((2*3))')
    await page.keyboard.press('Enter')
    await expect.poll(async () => rows.innerText(), { timeout: 30_000 }).toContain('second-6')

    // 两个标签是两条独立 shell：第一条标签的输出不该串到这里。
    await expect(rows).not.toContainText('rivet-42')

    // 切回第一条：回滚缓冲还在。
    await page.getByTestId('terminal-tab-1').click()
    await expect(terminalRows()).toContainText('rivet-42')

    // 关掉第二条，第一条继续可用。
    await page.getByTestId('terminal-tab-close-2').click()
    await expect(page.getByTestId('terminal-tab-2')).toBeHidden()
    await expect(terminalRows()).toContainText('rivet-42')
  })

  test('maximizes the terminal over the file area', async () => {
    const panel = terminalPanel()
    const docked = await panel.boundingBox()
    expect(docked?.height ?? 0).toBeGreaterThan(0)

    await page.getByTestId('terminal-maximize').click()
    // 铺满右侧内容区后，终端高度必然远超停靠态。
    await expect
      .poll(async () => (await panel.boundingBox())?.height ?? 0)
      .toBeGreaterThan((docked?.height ?? 0) * 1.5)

    // 必须是同一个 xterm 实例：换父节点会重建面板，历史输出随之消失。
    await expect(terminalRows()).toContainText('rivet-42')

    await page.getByTestId('terminal-maximize').click()
    await expect.poll(async () => (await panel.boundingBox())?.height ?? 0).toBeLessThan(400)
    await expect(terminalRows()).toContainText('rivet-42')
  })

  test('closes and reopens the terminal', async () => {
    await page.getByTestId('terminal-close').click()
    await expect(terminalPanel()).toBeHidden()
    // 收起抽屉会结束该会话的 shell，标签一并清空。
    await expect(page.getByTestId('terminal-tab-1')).toBeHidden()

    await page.getByTestId('toolbar-terminal').filter({ visible: true }).click()
    await expect(terminalPanel()).toBeVisible()
    await expect(page.getByTestId('terminal-tab-1')).toBeVisible()
    await expect
      .poll(async () => (await terminalRows().innerText()).trim().length, { timeout: 30_000 })
      .toBeGreaterThan(0)
  })
})
