import { DragOverlay, useDndContext } from '@dnd-kit/core'
import { type ConnectionConfig, type Session } from '@shared/types/index.js'
import ConnectionItem from './ConnectionItem.js'

interface DragOverlayContentProps {
  connections: ConnectionConfig[]
  getSessionByConnectionId: (id: string) => Session | undefined
}

export const DragOverlayContent = ({
  connections,
  getSessionByConnectionId,
}: DragOverlayContentProps) => {
  const { active } = useDndContext()
  const activeConnection = active
    ? connections.find((connection) => connection.id === String(active.id))
    : undefined

  if (!activeConnection) return null

  return (
    <DragOverlay>
      <div className="w-56 opacity-90 shadow-dropdown">
        <ConnectionItem
          connection={activeConnection}
          session={getSessionByConnectionId(activeConnection.id)}
          isActive={false}
          onSelect={() => {}}
          onDisconnect={() => {}}
          onReconnect={() => {}}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      </div>
    </DragOverlay>
  )
}

export default DragOverlayContent
