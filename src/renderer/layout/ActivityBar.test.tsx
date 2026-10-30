import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SIDEBAR_VIEW } from '@shared/constants/transfer.js'
import { ActivityBar } from './ActivityBar.js'

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

describe('ActivityBar', () => {
  it('keeps the two view buttons', () => {
    const onViewChange = vi.fn()

    render(<ActivityBar activeView={SIDEBAR_VIEW.CONNECTIONS} onViewChange={onViewChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'activityBar.transfers' }))
    expect(onViewChange).toHaveBeenCalledWith(SIDEBAR_VIEW.TRANSFERS)
  })
})
