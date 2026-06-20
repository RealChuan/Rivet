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

vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
)

vi.stubGlobal(
  'ResizeObserver',
  vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  })),
)

Object.defineProperty(document.documentElement, 'classList', {
  value: {
    add: vi.fn(),
    remove: vi.fn(),
    toggle: vi.fn(),
    contains: vi.fn().mockReturnValue(false),
  },
})

Object.defineProperty(document.documentElement, 'dataset', {
  value: {},
  writable: true,
})

afterEach(() => {
  vi.resetAllMocks()
})
