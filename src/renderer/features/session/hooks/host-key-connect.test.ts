import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionConfig } from '@shared/types/index.js'
import { ProtocolStatus, SftpStatus, HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import { handleConnectWithHostKey } from './host-key-connect.js'

const mockConnect = vi.fn()
const mockDisconnect = vi.fn()
const mockHostKeySave = vi.fn()
const mockHostKeyDelete = vi.fn()
const mockSetHostKeyVerificationDialog = vi.fn()

vi.mock('@renderer/features/host-key/stores/host-key.js', () => ({
  useHostKeyStore: {
    getState: () => ({
      setHostKeyVerificationDialog: mockSetHostKeyVerificationDialog,
    }),
  },
}))

const baseConfig: ConnectionConfig = {
  id: 'conn-1',
  name: 'TestServer',
  protocol: 'sftp',
  host: 'example.com',
  port: 22,
  username: 'user',
}

describe('handleConnectWithHostKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    ;(window as any).electronAPI = {
      protocol: {
        connect: mockConnect,
        disconnect: mockDisconnect,
      },
      hostKey: {
        save: mockHostKeySave,
        delete: mockHostKeyDelete,
      },
    }
  })

  it('returns success true on OK status', async () => {
    mockConnect.mockResolvedValue({
      success: true,
      value: { sessionId: 'sess-1', statusCode: ProtocolStatus.OK, detail: {} },
    })

    const result = await handleConnectWithHostKey(baseConfig)

    expect(result).toEqual({ success: true, sessionId: 'sess-1', retry: false })
    expect(mockSetHostKeyVerificationDialog).not.toHaveBeenCalled()
  })

  it('throws Error on error response', async () => {
    mockConnect.mockResolvedValue({
      success: false,
      error: { message: 'Connection refused' },
    })

    await expect(handleConnectWithHostKey(baseConfig)).rejects.toThrow('Connection refused')
  })

  it('saves host key and returns success on FIRST_CONNECT with user confirm', async () => {
    mockConnect.mockResolvedValue({
      success: true,
      value: {
        sessionId: 'sess-2',
        statusCode: ProtocolStatus.FIRST_CONNECT,
        detail: { hash: 'abc123' },
      },
    })

    mockSetHostKeyVerificationDialog.mockImplementation((dialog: Record<string, unknown>) => {
      if (dialog.open && dialog.onConfirm) {
        const onConfirm = dialog.onConfirm as () => void
        onConfirm()
      }
    })

    const result = await handleConnectWithHostKey(baseConfig)

    expect(mockSetHostKeyVerificationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HOST_KEY_DIALOG_TYPE.FIRST_CONNECT,
        hash: 'abc123',
        previousHash: undefined,
        sessionId: 'sess-2',
        connectionId: 'conn-1',
        open: true,
      }),
    )
    expect(mockHostKeySave).toHaveBeenCalledWith({ connectionId: 'conn-1', hash: 'abc123' })
    expect(result).toEqual({ success: true, sessionId: 'sess-2', retry: false })
  })

  it('disconnects, deletes host key, and returns failure on FIRST_CONNECT with user cancel', async () => {
    mockConnect.mockResolvedValue({
      success: true,
      value: {
        sessionId: 'sess-3',
        statusCode: ProtocolStatus.FIRST_CONNECT,
        detail: { hash: 'abc123' },
      },
    })

    mockSetHostKeyVerificationDialog.mockImplementation((dialog: Record<string, unknown>) => {
      if (dialog.open && dialog.onCancel) {
        const onCancel = dialog.onCancel as () => void
        onCancel()
      }
    })

    const result = await handleConnectWithHostKey(baseConfig)

    expect(mockDisconnect).toHaveBeenCalledWith('sess-3')
    expect(mockHostKeyDelete).toHaveBeenCalledWith('conn-1')
    expect(result).toEqual({ success: false, sessionId: null, retry: false })
  })

  it('saves host key and returns retry true on HOST_KEY_MISMATCH with user confirm', async () => {
    mockConnect.mockResolvedValue({
      success: true,
      value: {
        sessionId: '',
        statusCode: SftpStatus.HOST_KEY_MISMATCH,
        detail: { hash: 'def456', previousHash: 'abc123' },
      },
    })

    mockSetHostKeyVerificationDialog.mockImplementation((dialog: Record<string, unknown>) => {
      if (dialog.open && dialog.onConfirm) {
        const onConfirm = dialog.onConfirm as () => void
        onConfirm()
      }
    })

    const result = await handleConnectWithHostKey(baseConfig)

    expect(mockSetHostKeyVerificationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HOST_KEY_DIALOG_TYPE.MISMATCH,
        hash: 'def456',
        previousHash: 'abc123',
        sessionId: '',
        connectionId: 'conn-1',
        open: true,
      }),
    )
    expect(mockHostKeySave).toHaveBeenCalledWith({ connectionId: 'conn-1', hash: 'def456' })
    expect(result).toEqual({ success: false, sessionId: null, retry: true })
  })

  it('returns failure without saving on HOST_KEY_MISMATCH with user cancel', async () => {
    mockConnect.mockResolvedValue({
      success: true,
      value: {
        sessionId: '',
        statusCode: SftpStatus.HOST_KEY_MISMATCH,
        detail: { hash: 'def456', previousHash: 'abc123' },
      },
    })

    mockSetHostKeyVerificationDialog.mockImplementation((dialog: Record<string, unknown>) => {
      if (dialog.open && dialog.onCancel) {
        const onCancel = dialog.onCancel as () => void
        onCancel()
      }
    })

    const result = await handleConnectWithHostKey(baseConfig)

    expect(mockHostKeySave).not.toHaveBeenCalled()
    expect(result).toEqual({ success: false, sessionId: null, retry: false })
  })

  it('returns failure on unknown status', async () => {
    mockConnect.mockResolvedValue({
      success: true,
      value: { sessionId: 'sess-4', statusCode: 9999, detail: {} },
    })

    const result = await handleConnectWithHostKey(baseConfig)

    expect(result).toEqual({ success: false, sessionId: null, retry: false })
    expect(mockSetHostKeyVerificationDialog).not.toHaveBeenCalled()
    expect(mockHostKeySave).not.toHaveBeenCalled()
    expect(mockDisconnect).not.toHaveBeenCalled()
    expect(mockHostKeyDelete).not.toHaveBeenCalled()
  })
})
