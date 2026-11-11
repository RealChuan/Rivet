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
    await expect(page.getByTestId('terminal-panel')).toBeVisible()

    const rows = terminalRows()
    // 等提示符出现：说明 shell 通道与首屏输出都通了。
    await expect
      .poll(async () => (await rows.innerText()).trim().length, { timeout: 30_000 })
      .toBeGreaterThan(0)

    await page.getByTestId('terminal-panel').click()
    // 用算术表达式生成标记：敲进去的字符里不含 rivet-42，只有 shell 输出才会出现。
    await page.keyboard.type('echo rivet-$((6*7))')
    await page.keyboard.press('Enter')

    await expect.poll(async () => rows.innerText(), { timeout: 30_000 }).toContain('rivet-42')
  })

  test('maximizes the terminal over the file area', async () => {
    const panel = page.getByTestId('terminal-panel')
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
    await expect(page.getByTestId('terminal-panel')).toBeHidden()

    await page.getByTestId('toolbar-terminal').filter({ visible: true }).click()
    await expect(page.getByTestId('terminal-panel')).toBeVisible()
    await expect
      .poll(async () => (await terminalRows().innerText()).trim().length, { timeout: 30_000 })
      .toBeGreaterThan(0)
  })
})
