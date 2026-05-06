import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import { useHostKeyStore } from './host-key.js'

describe('host key store', () => {
  beforeEach(() => {
    useHostKeyStore.setState({
      hostKeyDialog: {
        open: false,
        type: HOST_KEY_DIALOG_TYPE.UNKNOWN,
        host: '',
        port: 22,
        algorithm: '',
        fingerprint: '',
        previousFingerprint: undefined,
      },
    })
  })

  it('has the unknown/mismatch initial state', () => {
    const state = useHostKeyStore.getState().hostKeyDialog
    expect(state).toMatchObject({
      open: false,
      type: HOST_KEY_DIALOG_TYPE.UNKNOWN,
      host: '',
      port: 22,
      algorithm: '',
      fingerprint: '',
    })
    expect(state.previousFingerprint).toBeUndefined()
  })

  it('opens with host/port/algorithm/fingerprint', () => {
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      type: HOST_KEY_DIALOG_TYPE.MISMATCH,
      host: 'example.com',
      port: 2222,
      algorithm: 'ssh-ed25519',
      fingerprint: 'SHA256:new',
      previousFingerprint: 'SHA256:old',
    })

    expect(useHostKeyStore.getState().hostKeyDialog).toMatchObject({
      open: true,
      type: HOST_KEY_DIALOG_TYPE.MISMATCH,
      host: 'example.com',
      port: 2222,
      algorithm: 'ssh-ed25519',
      fingerprint: 'SHA256:new',
      previousFingerprint: 'SHA256:old',
    })
  })

  it('preserves fields on partial updates and stores callbacks', () => {
    const onConfirm = vi.fn()
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      host: 'h',
      onConfirm,
    })
    useHostKeyStore.getState().setHostKeyVerificationDialog({ open: false })

    const state = useHostKeyStore.getState().hostKeyDialog
    expect(state.host).toBe('h')
    expect(state.open).toBe(false)
    state.onConfirm?.()
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
