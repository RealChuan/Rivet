import { describe, expect, it } from 'vitest'
import { scrubSentryEvent } from './sentry-scrub.js'

describe('scrubSentryEvent', () => {
  it('removes request, path-like keys and breadcrumb urls without mutating input', () => {
    const event = {
      request: { url: 'https://example.com/secret' },
      extra: { localPath: '/home/a', componentStack: 'at App' },
      contexts: { remotePath: '/srv/b', runtime: { name: 'node' } },
      breadcrumbs: [{ message: 'open', data: { url: '/home/a', path: '/srv/b', foo: 'bar' } }],
    }

    const scrubbed = scrubSentryEvent(event)

    expect(scrubbed.request).toBeUndefined()
    expect(scrubbed.extra).toEqual({ componentStack: 'at App' })
    expect(scrubbed.contexts).toEqual({ runtime: { name: 'node' } })
    expect(scrubbed.breadcrumbs?.[0]?.data).toEqual({ foo: 'bar' })
    expect(event.extra.localPath).toBe('/home/a')
  })
})
