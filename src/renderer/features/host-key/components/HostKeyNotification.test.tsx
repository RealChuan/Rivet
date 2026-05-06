import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import { HostKeyNotification } from './HostKeyNotification.js'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (selector: (ns: unknown) => unknown) => {
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
      selector(proxy)
      return path.join('.')
    },
  }),
}))

describe('HostKeyNotification', () => {
  it('renders host, algorithm and fingerprint', () => {
    render(
      <HostKeyNotification
        type={HOST_KEY_DIALOG_TYPE.UNKNOWN}
        host="example.com"
        port={22}
        algorithm="ssh-ed25519"
        fingerprint="SHA256:abc"
      />,
    )

    expect(screen.getByText('example.com:22')).not.toBeNull()
    expect(screen.getByText('ssh-ed25519')).not.toBeNull()
    expect(screen.getByText('SHA256:abc')).not.toBeNull()
  })

  it('renders the previous fingerprint on mismatch', () => {
    render(
      <HostKeyNotification
        type={HOST_KEY_DIALOG_TYPE.MISMATCH}
        host="example.com"
        port={22}
        algorithm="ssh-ed25519"
        fingerprint="SHA256:new"
        previousFingerprint="SHA256:old"
      />,
    )

    expect(screen.getByText('SHA256:old')).not.toBeNull()
  })
})
