import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import FilePropertiesDialog from './FilePropertiesDialog.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | ((ns: unknown) => unknown)) => {
      if (typeof key === 'function') {
        const path: string[] = []
        const proxy = new Proxy(
          {},
          {
            get(_target, prop) {
              if (typeof prop === 'string') path.push(prop)
              return proxy
            },
          },
        )
        key(proxy)
        return path.join('.')
      }
      return key
    },
    i18n: { language: 'en-US' },
  }),
  initReactI18next: vi.fn(),
}))

vi.mock('../../session/stores/session.js', () => ({
  useSessionStore: (selector: (state: { activeSessionId: string }) => unknown) =>
    selector({ activeSessionId: 's1' }),
}))

vi.mock('../hooks/use-folder-stats.js', () => ({
  useFolderStats: () => ({
    progress: null,
    isCalculating: false,
    error: null,
    start: vi.fn(),
    cancel: vi.fn(),
  }),
}))

const noop = () => {}

const FILE: FileInfo = {
  name: 'run.sh',
  type: 'file',
  size: 2048,
  modifyTime: 1700000000000,
  absolutePath: '/run.sh',
  permissions: 'rwxr-xr-x',
  mode: 0o100755,
  owner: 'alice',
  isHidden: false,
}

const DIRECTORY: FileInfo = {
  name: 'docs',
  type: 'directory',
  size: 0,
  modifyTime: 1700000000000,
  absolutePath: '/docs',
  permissions: 'rwxr-xr-x',
  mode: 0o40755,
  owner: 'alice',
  isHidden: false,
}

describe('FilePropertiesDialog', () => {
  it('文件显示大小与元数据，不显示目录统计', () => {
    render(<FilePropertiesDialog open onClose={noop} file={FILE} isSftp />)

    expect(screen.getByText('properties.size')).not.toBeNull()
    expect(screen.getByText('2 KB')).not.toBeNull()
    expect(screen.getByText('alice')).not.toBeNull()
    expect(screen.queryByText('properties.fileCount')).toBeNull()
    expect(screen.queryByText('properties.folderCount')).toBeNull()
  })

  it('目录保留统计区块', () => {
    render(<FilePropertiesDialog open onClose={noop} file={DIRECTORY} isSftp />)

    expect(screen.getByText('properties.fileCount')).not.toBeNull()
    expect(screen.getByText('properties.folderCount')).not.toBeNull()
  })

  it('SFTP 下权限行可点击进入编辑器', async () => {
    const onEditPermissions = vi.fn()
    render(
      <FilePropertiesDialog
        open
        onClose={noop}
        file={FILE}
        isSftp
        onEditPermissions={onEditPermissions}
      />,
    )

    await userEvent.click(screen.getByLabelText('permissions.title'))

    expect(onEditPermissions).toHaveBeenCalledWith(FILE)
  })

  it('非 SFTP 会话不显示权限与所有者', () => {
    render(<FilePropertiesDialog open onClose={noop} file={FILE} />)

    expect(screen.queryByText('properties.permissions')).toBeNull()
    expect(screen.queryByText('properties.owner')).toBeNull()
  })
})
