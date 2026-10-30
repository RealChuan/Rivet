export interface SentryBreadcrumbLike {
  message?: string
  data?: Record<string, unknown>
}

export interface SentryEventLike {
  request?: unknown
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
  breadcrumbs?: SentryBreadcrumbLike[]
}

const PATH_KEY = /path|file(name)?|local|remote|url/i

function scrubRecord(
  record: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  if (!record) return undefined
  return Object.fromEntries(Object.entries(record).filter(([key]) => !PATH_KEY.test(key)))
}

export function scrubSentryEvent<T extends SentryEventLike>(event: T): T {
  const next = { ...event }
  delete next.request

  delete next.extra
  const extra = scrubRecord(event.extra)
  if (extra) next.extra = extra

  delete next.contexts
  const contexts = scrubRecord(event.contexts)
  if (contexts) next.contexts = contexts

  if (event.breadcrumbs) {
    next.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
      const data = scrubRecord(breadcrumb.data)
      if (data) return { ...breadcrumb, data }
      const withoutData = { ...breadcrumb }
      delete withoutData.data
      return withoutData
    })
  }

  return next
}
