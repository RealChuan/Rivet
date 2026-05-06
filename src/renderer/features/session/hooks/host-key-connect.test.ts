import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectRequest } from '@shared/types/index.js'
import { HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import { handleConnectWithHostKey } from './host-key-connect.js'

const mockConnect = vi.fn()
const mockTrust = vi.fn()
const mockSetHostKeyVerificationDialog = vi.fn()

vi.mock('../../host-key/stores/host-key.js', () => ({
  useHostKeyStore: {
    getState: () => ({
      setHostKeyVerificationDialog: mockSetHostKeyVerificationDialog,
    }),
  },
}))

const request: ConnectRequest = {
  connection: {
    id: 'conn-1',
    name: 'TestServer',
    protocol: 'sftp',
    host: 'example.com',
    port: 22,
    username: 'user',
    authKind: 'password',
  },
}

const unknownError = {
  code: 'HOST_KEY_UNKNOWN',
  message: 'Unknown host key',
  detail: {
    host: 'example.com',
    port: 22,
    algorithm: 'ssh-ed25519',
    fingerprint: 'SHA256:new',
  },
}

const mismatchError = {
  code: 'HOST_KEY_MISMATCH',
  message: 'Host key mismatch',
  detail: {
    host: 'example.com',
    port: 22,
    algorithm: 'ssh-ed25519',
    fingerprint: 'SHA256:new',
    previousFingerprint: 'SHA256:old',
  },
}

function confirmDialog(): void {
  mockSetHostKeyVerificationDialog.mockImplementation((dialog: Record<string, unknown>) => {
    if (dialog.open && dialog.onConfirm) {
      const onConfirm = dialog.onConfirm as () => void
      onConfirm()
    }
  })
}

function cancelDialog(): void {
  mockSetHostKeyVerificationDialog.mockImplementation((dialog: Record<string, unknown>) => {
    if (dialog.open && dialog.onCancel) {
      const onCancel = dialog.onCancel as () => void
      onCancel()
    }
  })
}

describe('handleConnectWithHostKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTrust.mockResolvedValue({ success: true, value: null, error: null })
    Object.assign(window, {
      electronAPI: {
        protocol: { connect: mockConnect },
        hostKey: { trust: mockTrust },
      },
    })
  })

  it('returns success on a successful connect', async () => {
    mockConnect.mockResolvedValue({
      success: true,
      value: { sessionId: 'sess-1', capabilities: {} },
    })

    await expect(handleConnectWithHostKey(request)).resolves.toEqual({
      success: true,
      sessionId: 'sess-1',
      retry: false,
    })
    expect(mockSetHostKeyVerificationDialog).not.toHaveBeenCalled()
  })

  it('throws non-host-key errors', async () => {
    mockConnect.mockResolvedValue({
      success: false,
      error: { code: 'CONN_FAILED', message: 'Connection refused' },
    })

    await expect(handleConnectWithHostKey(request)).rejects.toThrow('Connection refused')
  })

  it('trusts an unknown key and asks for a retry', async () => {
    mockConnect.mockResolvedValue({ success: false, error: unknownError })
    confirmDialog()

    const result = await handleConnectWithHostKey(request)

    expect(mockSetHostKeyVerificationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HOST_KEY_DIALOG_TYPE.UNKNOWN,
        host: 'example.com',
        port: 22,
        algorithm: 'ssh-ed25519',
        fingerprint: 'SHA256:new',
        open: true,
      }),
    )
    expect(mockTrust).toHaveBeenCalledWith({
      host: 'example.com',
      port: 22,
      algorithm: 'ssh-ed25519',
      fingerprint: 'SHA256:new',
    })
    expect(result).toEqual({ success: false, sessionId: null, retry: true })
  })

  it('returns failure when the user cancels an unknown key', async () => {
    mockConnect.mockResolvedValue({ success: false, error: unknownError })
    cancelDialog()

    await expect(handleConnectWithHostKey(request)).resolves.toEqual({
      success: false,
      sessionId: null,
      retry: false,
    })
    expect(mockTrust).not.toHaveBeenCalled()
  })

  it('shows the previous fingerprint on mismatch', async () => {
    mockConnect.mockResolvedValue({ success: false, error: mismatchError })
    confirmDialog()

    const result = await handleConnectWithHostKey(request)

    expect(mockSetHostKeyVerificationDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        type: HOST_KEY_DIALOG_TYPE.MISMATCH,
        previousFingerprint: 'SHA256:old',
      }),
    )
    expect(result).toEqual({ success: false, sessionId: null, retry: true })
  })

  it('returns failure when the user cancels a mismatch', async () => {
    mockConnect.mockResolvedValue({ success: false, error: mismatchError })
    cancelDialog()

    await expect(handleConnectWithHostKey(request)).resolves.toEqual({
      success: false,
      sessionId: null,
      retry: false,
    })
    expect(mockTrust).not.toHaveBeenCalled()
  })
})
