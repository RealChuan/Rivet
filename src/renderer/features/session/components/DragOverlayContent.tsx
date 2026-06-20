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

  return (
    <DragOverlay>
      {active ? (
        <div className="shadow-dropdown">
          {(() => {
            const connection = connections.find((c) => c.id === String(active.id))
            if (!connection) return null
            return (
              <ConnectionItem
                connection={connection}
                session={getSessionByConnectionId(String(active.id))}
                isActive={false}
                onSelect={() => {}}
                onDisconnect={() => {}}
                onReconnect={() => {}}
                onEdit={() => {}}
                onDelete={() => {}}
              />
            )
          })()}
        </div>
      ) : null}
    </DragOverlay>
  )
}

export default DragOverlayContent
