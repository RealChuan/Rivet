import { vi } from 'vitest'

const log = {
  initialize: vi.fn(),
  transports: {
    file: {
      resolvePathFn: vi.fn(),
      level: 'info',
    },
    console: {
      level: 'info',
    },
  },
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}

export default log
