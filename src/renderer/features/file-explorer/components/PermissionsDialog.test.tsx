import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FileInfo } from '@shared/types/index.js'
import PermissionsDialog from './PermissionsDialog.js'

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

const noop = () => {}

const FILE: FileInfo = {
  name: 'run.sh',
  type: 'file',
  size: 0,
  modifyTime: 0,
  absolutePath: '/run.sh',
  permissions: 'rw-r--r--',
  mode: 0o100644,
  isHidden: false,
}

const octalInput = () => screen.getByLabelText<HTMLInputElement>('permissions.octal')

const cell = (group: string, action: string) =>
  screen.getByLabelText<HTMLElement>(`permissions.${group} permissions.${action}`)

const isChecked = (group: string, action: string) =>
  cell(group, action).getAttribute('aria-checked') === 'true'

const saveButton = () =>
  screen.getByRole<HTMLButtonElement>('button', { name: 'common.action.save' })

describe('PermissionsDialog', () => {
  it('按当前权限位回填八进制与 rwx 矩阵', () => {
    render(<PermissionsDialog open onClose={noop} file={FILE} onApply={noop} />)

    expect(octalInput().value).toBe('644')
    expect(isChecked('owner', 'read')).toBe(true)
    expect(isChecked('owner', 'write')).toBe(true)
    expect(isChecked('owner', 'execute')).toBe(false)
    expect(isChecked('other', 'read')).toBe(true)
    expect(isChecked('other', 'execute')).toBe(false)
  })

  it('勾选执行位时同步八进制', async () => {
    render(<PermissionsDialog open onClose={noop} file={FILE} onApply={noop} />)

    await userEvent.click(cell('owner', 'execute'))

    expect(octalInput().value).toBe('744')
  })

  it('输入八进制时同步 rwx 矩阵', async () => {
    render(<PermissionsDialog open onClose={noop} file={FILE} onApply={noop} />)

    await userEvent.clear(octalInput())
    await userEvent.type(octalInput(), '600')

    expect(isChecked('owner', 'read')).toBe(true)
    expect(isChecked('owner', 'write')).toBe(true)
    expect(isChecked('group', 'read')).toBe(false)
    expect(isChecked('other', 'read')).toBe(false)
  })

  it('八进制不足三位时禁用保存', async () => {
    render(<PermissionsDialog open onClose={noop} file={FILE} onApply={noop} />)

    await userEvent.clear(octalInput())

    expect(saveButton().disabled).toBe(true)
  })

  it('应用时把 edited 位与特殊位合并', async () => {
    const onApply = vi.fn()
    render(
      <PermissionsDialog
        open
        onClose={noop}
        file={{ ...FILE, permissions: 'rwxr-xr-x', mode: 0o42755 }}
        onApply={onApply}
      />,
    )

    await userEvent.click(cell('other', 'write'))
    await userEvent.click(saveButton())

    expect(onApply).toHaveBeenCalledWith(0o2757)
  })
})
