import { ipcRenderer, type IpcRendererEvent } from 'electron'

interface RegisteredListener {
  channel: string
  handler: (...args: unknown[]) => void
}

class ListenerManager {
  private listeners: RegisteredListener[] = []

  on<T extends unknown[]>(
    channel: string,
    handler: (event: IpcRendererEvent, ...args: T) => void
  ): () => void {
    const wrappedHandler = handler as (...args: unknown[]) => void
    ipcRenderer.on(channel, wrappedHandler)
    const registered: RegisteredListener = { channel, handler: wrappedHandler }
    this.listeners.push(registered)

    return () => {
      ipcRenderer.removeListener(channel, wrappedHandler)
      const index = this.listeners.indexOf(registered)
      if (index !== -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  cleanup(): void {
    this.listeners.forEach(({ channel, handler }) => {
      ipcRenderer.removeListener(channel, handler)
    })
    this.listeners = []
  }
}

export const listenerManager = new ListenerManager()

window.addEventListener('beforeunload', () => {
  listenerManager.cleanup()
})
