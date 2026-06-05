import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useUiStore } from '@renderer/stores/index.js'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { useSessionStore } from '../stores/session.js'

export const useSessionDisconnect = () => {
  const { t } = useTranslation()
  const getSessionByConnectionId = useSessionStore(state => state.getSessionByConnectionId)
  const removeSession = useSessionStore(state => state.removeSession)
  const addToast = useUiStore(state => state.addToast)

  useEffect(() => {
    const unsubscribe = window.electronAPI.protocol.onSessionDisconnected(event => {
      const sessionData = getSessionByConnectionId(event.connectionId)
      if (sessionData) {
        removeSession(sessionData.sessionId)
      }

      addToast({
        type: TOAST_TYPE.ERROR,
        message: t('toast.connectionLost', {
          protocol: event.protocol.toUpperCase(),
          name: event.name,
        }),
      })
    })

    return unsubscribe
  }, [t, getSessionByConnectionId, removeSession, addToast])
}
