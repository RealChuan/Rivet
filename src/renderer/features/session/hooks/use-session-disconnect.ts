import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TOAST_TYPE } from '@shared/constants/index.js'
import { protocolApi } from '../../../api/protocol.js'
import { useUiStore } from '../../../stores/index.js'
import { useSessionStore } from '../stores/session.js'

export const useSessionDisconnect = () => {
  const { t } = useTranslation()
  const getSessionByConnectionId = useSessionStore((state) => state.getSessionByConnectionId)
  const removeSession = useSessionStore((state) => state.removeSession)
  const addToast = useUiStore((state) => state.addToast)

  useEffect(() => {
    const unsubscribe = protocolApi.onSessionDisconnected((event) => {
      const sessionData = getSessionByConnectionId(event.connectionId)
      if (sessionData) {
        removeSession(sessionData.sessionId)
      }

      addToast({
        type: TOAST_TYPE.ERROR,
        message: t(($) => $.toast.connectionLost, {
          protocol: event.protocol.toUpperCase(),
          name: event.name,
        }),
      })
    })

    return unsubscribe
  }, [t, getSessionByConnectionId, removeSession, addToast])
}
