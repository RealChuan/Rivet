import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

/** 默认连本机 Docker compose；服务跑在别的机器上时用 RIVET_E2E_HOST 指定。 */
const E2E_HOST = process.env.RIVET_E2E_HOST ?? '127.0.0.1'

const SFTP = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'E2E SFTP',
  protocol: 'sftp',
  host: E2E_HOST,
  port: 2222,
  username: 'testuser',
  authKind: 'password',
} as const

const SMB = {
  id: '00000000-0000-4000-8000-000000000002',
  name: 'E2E SMB',
  protocol: 'smb',
  host: E2E_HOST,
  port: 1445,
  username: 'testuser',
  share: 'rivet',
} as const

let app: ElectronApplication
let page: Page
let userDataDir: string
let tempDir: string

async function fillConnection(fields: {
  name: string
  host: string
  port: string
  username: string
  password: string
}): Promise<void> {
  await page.getByTestId('connection-name').fill(fields.name)
  await page.getByTestId('connection-host').fill(fields.host)
  await page.getByTestId('connection-port').fill(fields.port)
  await page.getByTestId('connection-username').fill(fields.username)
  await page.getByTestId('connection-password').fill(fields.password)
}

/** 对话框按钮文案随语言变化（创建/确认/Create…），统一点对话框里排在最后的主按钮。 */
async function confirmDialog(): Promise<void> {
  await page.getByRole('dialog').getByRole('button').last().click()
}

async function connectSftp(): Promise<void> {
  await page.getByTestId('connection-new').click()
  await expect(page.getByTestId('connection-dialog')).toBeVisible()
  await fillConnection({
    name: 'E2E SFTP',
    host: E2E_HOST,
    port: '2222',
    username: 'testuser',
    password: 'testpass',
  })
  await page.getByTestId('connection-save').click()
  await expect(page.getByTestId('host-key-confirm')).toBeVisible()
  await page.getByTestId('host-key-confirm').click()
  await expect(page.getByTestId('connection-item')).toBeVisible()
  await expect(page.getByTestId('connection-dialog')).toBeHidden()
}

async function openSftpFiles(): Promise<void> {
  await page.getByTestId('connection-item').first().click()
  await expect(page.getByTestId('toolbar-refresh')).toBeVisible()
}

/**
 * atmoz/sftp 把用户 chroot 到家目录，只有 home 下的 upload/ 可写：
 * 在根目录新建文件夹会被服务端拒绝，所以写操作前先从 UI 进入 upload/。
 */
async function enterWritableSftpDir(): Promise<void> {
  const uploadRow = page.locator('[data-testid="file-row"][data-file-path="/upload"]')
  await expect(uploadRow).toBeVisible()
  await uploadRow.dblclick()
  await expect(uploadRow).toBeHidden()
}

test.describe.serial('smoke', () => {
  test.beforeAll(async () => {
    userDataDir = mkdtempSync(join(tmpdir(), 'rivet-e2e-user-'))
    tempDir = mkdtempSync(join(tmpdir(), 'rivet-e2e-files-'))
    app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] })
    page = await app.firstWindow()
    await expect(page.getByTestId('connection-page')).toBeVisible()
  })

  test.afterAll(async () => {
    await app.close()
    rmSync(userDataDir, { recursive: true, force: true })
    rmSync(tempDir, { recursive: true, force: true })
  })

  test('starts without uncaught renderer errors', async () => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.waitForTimeout(500)
    expect(errors).toEqual([])
  })

  test('connects to SFTP and lists the directory', async () => {
    await connectSftp()
    await openSftpFiles()
    await expect(page.getByTestId('file-row').first()).toBeVisible()
  })

  test('switches list/grid and keeps the selection', async () => {
    await page.getByTestId('file-row').first().click()
    await page.getByTestId('view-mode-grid').click()
    await expect(page.getByTestId('file-view')).toHaveAttribute('data-view-mode', 'grid')
    await page.getByTestId('view-mode-list').click()
    await expect(page.getByTestId('file-view')).toHaveAttribute('data-view-mode', 'list')
  })

  test('creates, renames and deletes a folder', async () => {
    await enterWritableSftpDir()
    await page.getByTestId('toolbar-new-folder').click()
    await page.getByRole('textbox').last().fill('e2e-folder')
    await confirmDialog()

    const row = page.locator('[data-testid="file-row"][data-file-path$="e2e-folder"]')
    await expect(row).toBeVisible()
    await row.click({ button: 'right' })
    await page.getByTestId('context-rename').click()
    await page.getByRole('textbox').last().fill('e2e-renamed')
    await confirmDialog()

    const renamed = page.locator('[data-testid="file-row"][data-file-path$="e2e-renamed"]')
    await expect(renamed).toBeVisible()
    await renamed.click({ button: 'right' })
    await page.getByTestId('context-delete').click()
    await confirmDialog()
    await expect(renamed).toBeHidden()
  })

  test('uploads and downloads through the real server', async () => {
    const localPath = join(tempDir, 'e2e-upload.txt')
    writeFileSync(localPath, 'rivet-e2e')
    const downloadDir = join(tempDir, 'downloads')
    mkdirSync(downloadDir, { recursive: true })
    // 下载任务的本地文件名由 localDir + itemName 决定，不存在时按原名落盘。
    const downloadPath = join(downloadDir, 'e2e-upload.txt')
    const size = statSync(localPath).size
    const uploadId = `e2e-up-${Date.now()}`
    const downloadId = `e2e-down-${Date.now()}`

    /** 完成的任务会被主进程立刻移出列表，轮询 getTasks 等不到 completed；列表只用来取失败原因。 */
    const taskError = async (taskId: string): Promise<string | null> =>
      page.evaluate(async (id) => {
        const tasks = await window.electronAPI.transfer.getTasks()
        if (!tasks.success) return tasks.error.message
        const task = tasks.value.find((candidate) => candidate.id === id)
        return task?.status === 'failed' ? (task.errorMessage ?? `task failed: ${id}`) : null
      }, taskId)

    /** 两次上传的字节数不同（10 → 20），轮询不会被上一轮遗留的同名文件满足。 */
    const waitForRemoteSize = async (
      sessionId: string,
      taskId: string,
      expectedSize: number,
    ): Promise<void> => {
      await expect
        .poll(
          async () => {
            const failure = await taskError(taskId)
            if (failure !== null) return failure
            return page.evaluate(
              async ({ sessionId, expectedSize }) => {
                const entries = await window.electronAPI.protocol.list(sessionId, '/upload')
                if (!entries.success) return entries.error.message
                const entry = entries.value.find((candidate) => candidate.name === 'e2e-upload.txt')
                return entry?.size === expectedSize ? 'uploaded' : 'pending'
              },
              { sessionId, expectedSize },
            )
          },
          { timeout: 30_000 },
        )
        .toBe('uploaded')
    }

    const upload = await page.evaluate(
      async ({ connection, localPath, uploadId, size }) => {
        const connect = await window.electronAPI.protocol.connect({
          connection: { ...connection, id: 'e2e-direct' },
          secret: 'testpass',
          saveSecret: false,
        })
        if (!connect.success) return { error: connect.error.message }
        const sessionId = connect.value.sessionId
        const upload = await window.electronAPI.transfer.add([
          {
            id: uploadId,
            sessionId,
            direction: 'upload',
            localPath,
            remotePath: '/upload/e2e-upload.txt',
            itemName: 'e2e-upload.txt',
            itemType: 'file',
            status: 'waiting',
            fileSize: size,
            transferredSize: 0,
            createdAt: Date.now(),
          },
        ])
        if (!upload.success) return { error: upload.error.message }
        return { sessionId }
      },
      { connection: SFTP, localPath, uploadId, size },
    )
    if ('error' in upload) throw new Error(upload.error)
    const sessionId = upload.sessionId
    await waitForRemoteSize(sessionId, uploadId, size)

    await page.evaluate(
      async ({ sessionId, downloadId, downloadPath, downloadDir, size }) => {
        const download = await window.electronAPI.transfer.add([
          {
            id: downloadId,
            sessionId,
            direction: 'download',
            localPath: downloadPath,
            localDir: downloadDir,
            remotePath: '/upload/e2e-upload.txt',
            itemName: 'e2e-upload.txt',
            itemType: 'file',
            status: 'waiting',
            fileSize: size,
            transferredSize: 0,
            createdAt: Date.now(),
          },
        ])
        if (!download.success) throw new Error(download.error.message)
      },
      { sessionId, downloadId, downloadPath, downloadDir, size },
    )
    await expect
      .poll(
        async () => {
          const failure = await taskError(downloadId)
          if (failure !== null) return failure
          if (!existsSync(downloadPath)) return 'pending'
          return readFileSync(downloadPath, 'utf8') === 'rivet-e2e' ? 'downloaded' : 'pending'
        },
        { timeout: 30_000 },
      )
      .toBe('downloaded')

    // 覆盖同名远端文件：SFTPv3 的 RENAME 不能覆盖已存在目标，必须先删目标。
    const overwritePath = join(tempDir, 'e2e-overwrite.txt')
    writeFileSync(overwritePath, 'rivet-e2e-overwrite')
    const overwriteSize = statSync(overwritePath).size
    const overwriteId = `e2e-over-${Date.now()}`
    await page.evaluate(
      async ({ sessionId, overwriteId, overwritePath, size }) => {
        const overwrite = await window.electronAPI.transfer.add([
          {
            id: overwriteId,
            sessionId,
            direction: 'upload',
            localPath: overwritePath,
            remotePath: '/upload/e2e-upload.txt',
            itemName: 'e2e-upload.txt',
            itemType: 'file',
            status: 'waiting',
            fileSize: size,
            transferredSize: 0,
            createdAt: Date.now(),
          },
        ])
        if (!overwrite.success) throw new Error(overwrite.error.message)
      },
      { sessionId, overwriteId, overwritePath, size: overwriteSize },
    )
    await waitForRemoteSize(sessionId, overwriteId, overwriteSize)

    await page.evaluate((id) => window.electronAPI.protocol.disconnect(id), sessionId)
  })

  test('connects to WebDAV and lists the directory', async () => {
    await page.getByTestId('connection-new').click()
    await page.getByTestId('connection-protocol').click()
    await page.getByRole('option', { name: 'WebDAV' }).click()
    await page.getByTestId('connection-scheme-http').click()
    await fillConnection({
      name: 'E2E WebDAV',
      host: E2E_HOST,
      port: '8080',
      username: 'testuser',
      password: 'testpass',
    })
    await page.getByTestId('connection-save').click()
    await expect(page.getByTestId('connection-item').nth(1)).toBeVisible()
    await page.getByTestId('connection-item').nth(1).click()
    // SFTP 会话没断开，两个面板都在 DOM 里、非活动的只是 display:none，直接查 testid 会命中 2 个。
    await expect(page.getByTestId('toolbar-refresh')).toHaveCount(2)
    await expect(page.getByTestId('toolbar-refresh').filter({ visible: true })).toHaveCount(1)
  })

  test('connects to SMB and lists the share', async () => {
    await page.getByTestId('connection-new').click()
    await page.getByTestId('connection-protocol').click()
    await page.getByRole('option', { name: 'SMB', exact: true }).click()
    await fillConnection({
      name: 'E2E SMB',
      host: E2E_HOST,
      port: '1445',
      username: 'testuser',
      password: 'testpass',
    })
    await page.getByTestId('connection-share').fill('rivet')
    await page.getByTestId('connection-save').click()

    const smbItem = page.getByTestId('connection-item').filter({ hasText: 'E2E SMB' })
    await expect(smbItem).toBeVisible()
    await smbItem.click()
    await expect(page.getByTestId('toolbar-refresh').filter({ visible: true })).toHaveCount(1)
    await expect(page.getByTestId('file-row').filter({ visible: true }).first()).toBeVisible()
  })

  test('SMB uploads a file and removes an empty folder', async () => {
    const folderName = `e2e-smb-${Date.now()}`
    const folderPath = `/${folderName}`
    const fileName = 'e2e-smb-upload.txt'
    const localPath = join(tempDir, fileName)
    writeFileSync(localPath, 'rivet-smb-e2e')
    const size = statSync(localPath).size
    const uploadId = `e2e-smb-up-${Date.now()}`

    const setup = await page.evaluate(
      async ({ connection, folderPath, localPath, uploadId, fileName, size }) => {
        const connect = await window.electronAPI.protocol.connect({
          connection: { ...connection, id: 'e2e-smb-direct' },
          secret: 'testpass',
          saveSecret: false,
        })
        if (!connect.success) return { error: connect.error.message }
        const sessionId = connect.value.sessionId

        const created = await window.electronAPI.protocol.mkdir(sessionId, folderPath)
        if (!created.success) return { error: created.error.message }

        const upload = await window.electronAPI.transfer.add([
          {
            id: uploadId,
            sessionId,
            direction: 'upload',
            localPath,
            remotePath: `${folderPath}/${fileName}`,
            itemName: fileName,
            itemType: 'file',
            status: 'waiting',
            fileSize: size,
            transferredSize: 0,
            createdAt: Date.now(),
          },
        ])
        if (!upload.success) return { error: upload.error.message }
        return { sessionId }
      },
      { connection: SMB, folderPath, localPath, uploadId, fileName, size },
    )
    if ('error' in setup) throw new Error(setup.error)
    const sessionId = setup.sessionId

    await expect
      .poll(
        async () =>
          page.evaluate(
            async ({ sessionId, folderPath, uploadId, fileName, size }) => {
              const tasks = await window.electronAPI.transfer.getTasks()
              const task = tasks.success
                ? tasks.value.find((candidate) => candidate.id === uploadId)
                : undefined
              if (task?.status === 'failed') return `failed: ${task.errorMessage ?? 'unknown'}`
              const entries = await window.electronAPI.protocol.list(sessionId, folderPath)
              if (!entries.success) return entries.error.message
              const entry = entries.value.find((candidate) => candidate.name === fileName)
              return entry?.size === size ? 'uploaded' : 'pending'
            },
            { sessionId, folderPath, uploadId, fileName, size },
          ),
        { timeout: 30_000 },
      )
      .toBe('uploaded')

    const cleanup = await page.evaluate(
      async ({ sessionId, folderPath, folderName, fileName }) => {
        const entries = await window.electronAPI.protocol.list(sessionId, folderPath)
        if (!entries.success) return { error: entries.error.message }
        const uploaded = entries.value.find((candidate) => candidate.name === fileName)
        if (!uploaded) return { error: `uploaded file not listed: ${fileName}` }

        const removeFile = await window.electronAPI.protocol.delete(sessionId, uploaded)
        if (!removeFile.success) return { error: removeFile.error.message }

        const root = await window.electronAPI.protocol.list(sessionId, '/')
        if (!root.success) return { error: root.error.message }
        const folder = root.value.find((candidate) => candidate.name === folderName)
        if (!folder) return { error: `folder not listed: ${folderName}` }

        const removeFolder = await window.electronAPI.protocol.delete(sessionId, folder)
        if (!removeFolder.success) return { error: removeFolder.error.message }

        const after = await window.electronAPI.protocol.list(sessionId, '/')
        if (!after.success) return { error: after.error.message }
        if (after.value.some((candidate) => candidate.name === folderName)) {
          return { error: `folder still exists: ${folderName}` }
        }

        const disconnected = await window.electronAPI.protocol.disconnect(sessionId)
        if (!disconnected.success) return { error: disconnected.error.message }
        return { ok: true }
      },
      { sessionId, folderPath, folderName, fileName },
    )
    if ('error' in cleanup) throw new Error(cleanup.error)
  })
})
