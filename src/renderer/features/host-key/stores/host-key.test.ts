import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HOST_KEY_DIALOG_TYPE } from '@shared/constants/index.js'
import { useHostKeyStore } from './host-key.js'

describe('host key store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: false,
      type: HOST_KEY_DIALOG_TYPE.FIRST_CONNECT,
      hash: '',
      sessionId: '',
      connectionId: '',
    })
    // Clear callbacks separately since setHostKeyVerificationDialog merges
    useHostKeyStore.setState({
      hostKeyDialog: {
        open: false,
        type: HOST_KEY_DIALOG_TYPE.FIRST_CONNECT,
        hash: '',
        previousHash: undefined,
        sessionId: '',
        connectionId: '',
      },
    })
  })

  it('should have correct initial state', () => {
    const state = useHostKeyStore.getState()
    expect(state.hostKeyDialog.open).toBe(false)
    expect(state.hostKeyDialog.type).toBe(HOST_KEY_DIALOG_TYPE.FIRST_CONNECT)
    expect(state.hostKeyDialog.hash).toBe('')
    expect(state.hostKeyDialog.previousHash).toBeUndefined()
    expect(state.hostKeyDialog.sessionId).toBe('')
    expect(state.hostKeyDialog.connectionId).toBe('')
  })

  it('should open dialog with partial state via setHostKeyVerificationDialog', () => {
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      type: HOST_KEY_DIALOG_TYPE.MISMATCH,
      hash: 'abc123',
      sessionId: 'session-1',
      connectionId: 'conn-1',
    })

    const state = useHostKeyStore.getState()
    expect(state.hostKeyDialog.open).toBe(true)
    expect(state.hostKeyDialog.type).toBe(HOST_KEY_DIALOG_TYPE.MISMATCH)
    expect(state.hostKeyDialog.hash).toBe('abc123')
    expect(state.hostKeyDialog.sessionId).toBe('session-1')
    expect(state.hostKeyDialog.connectionId).toBe('conn-1')
  })

  it('should preserve existing fields when updating partially', () => {
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      hash: 'hash1',
      sessionId: 's1',
    })

    // Update only open flag
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: false,
    })

    const state = useHostKeyStore.getState()
    expect(state.hostKeyDialog.open).toBe(false)
    expect(state.hostKeyDialog.hash).toBe('hash1')
    expect(state.hostKeyDialog.sessionId).toBe('s1')
  })

  it('should store and call onConfirm callback', () => {
    const onConfirm = vi.fn()
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      onConfirm,
    })

    const state = useHostKeyStore.getState()
    expect(state.hostKeyDialog.onConfirm).toBe(onConfirm)
    state.hostKeyDialog.onConfirm?.()
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('should store and call onCancel callback', () => {
    const onCancel = vi.fn()
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      onCancel,
    })

    const state = useHostKeyStore.getState()
    expect(state.hostKeyDialog.onCancel).toBe(onCancel)
    state.hostKeyDialog.onCancel?.()
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('should reset dialog to closed state', () => {
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      hash: 'some-hash',
      sessionId: 's1',
    })

    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: false,
      hash: '',
      sessionId: '',
    })

    const state = useHostKeyStore.getState()
    expect(state.hostKeyDialog.open).toBe(false)
    expect(state.hostKeyDialog.hash).toBe('')
    expect(state.hostKeyDialog.sessionId).toBe('')
  })

  it('should handle multiple consecutive setHostKeyVerificationDialog calls', () => {
    useHostKeyStore.getState().setHostKeyVerificationDialog({
      open: true,
      hash: 'hash1',
    })

    useHostKeyStore.getState().setHostKeyVerificationDialog({
      hash: 'hash2',
    })

    useHostKeyStore.getState().setHostKeyVerificationDialog({
      sessionId: 's2',
    })

    const state = useHostKeyStore.getState()
    expect(state.hostKeyDialog.open).toBe(true)
    expect(state.hostKeyDialog.hash).toBe('hash2')
    expect(state.hostKeyDialog.sessionId).toBe('s2')
  })
})
