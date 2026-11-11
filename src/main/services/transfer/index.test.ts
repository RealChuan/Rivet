import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TRANSFER_DIRECTION } from '@shared/constants/index.js'

const mockSetConcurrency = vi.fn()
const mockGetTransferSettings = vi.fn(() => ({
  maxUploadConcurrency: 7,
  maxDownloadConcurrency: 8,
  maxUploadBytesPerSecond: 1024 * 512,
  maxDownloadBytesPerSecond: 0,
}))

vi.mock('../../stores/index.js', () => ({
  getTransferSettings: () => mockGetTransferSettings(),
}))

vi.mock('../../transfer/transfer-service.js', () => ({
  TransferService: class {
    setConcurrency = mockSetConcurrency
    addTasks = vi.fn()
  },
}))

vi.mock('../../transfer/executor.js', () => ({ FileTransferExecutor: class {} }))
vi.mock('../../transfer/local-fs.js', () => ({ nodeLocalFs: {} }))
vi.mock('../../transfer/progress-aggregator.js', () => ({
  ProgressAggregator: class {
    constructor(_options: unknown) {}
  },
}))
vi.mock('../../providers/session-registry.js', () => ({
  providerSessionRegistry: { get: vi.fn() },
}))

describe('applyPersistedConcurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies persisted upload and download limits', async () => {
    const { applyPersistedConcurrency } = await import('./index.js')

    applyPersistedConcurrency()

    expect(mockSetConcurrency).toHaveBeenCalledWith(7, TRANSFER_DIRECTION.UPLOAD)
    expect(mockSetConcurrency).toHaveBeenCalledWith(8, TRANSFER_DIRECTION.DOWNLOAD)
  })
})

describe('speed limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('applies persisted speed limits per direction', async () => {
    const { applyPersistedSpeedLimits, getTransferSpeedLimit } = await import('./index.js')

    applyPersistedSpeedLimits()

    expect(getTransferSpeedLimit(TRANSFER_DIRECTION.UPLOAD)).toBe(1024 * 512)
    expect(getTransferSpeedLimit(TRANSFER_DIRECTION.DOWNLOAD)).toBe(0)
  })

  it('clamps the applied value and returns the effective one', async () => {
    const { setTransferSpeedLimit } = await import('./index.js')

    expect(setTransferSpeedLimit(TRANSFER_DIRECTION.UPLOAD, -1)).toBe(0)
    expect(setTransferSpeedLimit(TRANSFER_DIRECTION.UPLOAD, 1024 * 1024)).toBe(1024 * 1024)
  })
})
