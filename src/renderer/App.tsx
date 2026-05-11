import React from 'react'
import { SessionSidebar } from './features/session/index.js'
import { FileAreaContainer } from './features/file-explorer/index.js'
import { QueueDrawer } from './features/transfer/index.js'
import { MainLayout } from './layout/MainLayout.js'
import { useAppInit } from './hooks/useAppInit.js'
import { useSystemTheme } from './hooks/useSystemTheme.js'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts.js'
import { useTransferQueue } from './features/transfer/hooks/useTransferQueue.js'
import { useUiStore } from './stores/uiStore.js'

const App: React.FC = () => {
  const { initialized } = useUiStore()

  useAppInit()
  useSystemTheme()
  useGlobalShortcuts()
  useTransferQueue()

  if (!initialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-bg">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <MainLayout
      sidebar={<SessionSidebar />}
      content={<FileAreaContainer />}
      queueDrawer={<QueueDrawer />}
    />
  )
}

export default App
