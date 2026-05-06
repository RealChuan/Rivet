import { vi } from 'vitest'

const mockT = (key: string | ((ns: unknown) => unknown)) => {
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
}

vi.mock('i18next', () => ({
  default: {
    init: vi.fn().mockResolvedValue({}),
    use: vi.fn().mockReturnThis(),
    changeLanguage: vi.fn().mockResolvedValue({}),
    t: mockT,
    getFixedT: vi.fn(() => mockT),
  },
  useTranslation: () => ({
    t: mockT,
    i18n: {
      changeLanguage: vi.fn().mockResolvedValue({}),
    },
  }),
}))

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty' as const,
    init: vi.fn(),
  },
  useTranslation: () => ({
    t: mockT,
    i18n: {
      changeLanguage: vi.fn().mockResolvedValue({}),
    },
  }),
}))

afterEach(() => {
  vi.resetAllMocks()
})
