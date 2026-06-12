import { vi } from 'vitest'

vi.mock('i18next', () => ({
  default: {
    init: vi.fn().mockResolvedValue({}),
    use: vi.fn().mockReturnThis(),
    changeLanguage: vi.fn().mockResolvedValue({}),
    t: vi.fn((key: string) => key),
    getFixedT: vi.fn(() => vi.fn((key: string) => key)),
  },
  useTranslation: vi.fn().mockReturnValue({
    t: vi.fn((key: string) => key),
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
  }))
)

vi.stubGlobal(
  'ResizeObserver',
  vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
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
