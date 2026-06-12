import type React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { type ConnectionConfig, type Session } from '@shared/types/index.js'
import ConnectionItem from './ConnectionItem.js'

interface SortableConnectionItemProps {
  connection: ConnectionConfig
  session: Session | undefined
  isActive: boolean
  onSelect: () => void
  onDisconnect: () => void
  onReconnect: () => void
  onEdit: () => void
  onDelete: () => void
}

function transformToString(
  transform: { x: number; y: number; scaleX: number; scaleY: number } | null
): string | undefined {
  if (!transform) return undefined
  return `translate3d(${transform.x}px, ${transform.y}px, 0)`
}

export const SortableConnectionItem: React.FC<SortableConnectionItemProps> = ({
  connection,
  session,
  isActive,
  onSelect,
  onDisconnect,
  onReconnect,
  onEdit,
  onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: connection.id,
  })

  const style: React.CSSProperties = {
    transform: transformToString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
    zIndex: isDragging ? 50 : 'auto',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ConnectionItem
        connection={connection}
        session={session}
        isActive={isActive}
        onSelect={onSelect}
        onDisconnect={onDisconnect}
        onReconnect={onReconnect}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </div>
  )
}

export default SortableConnectionItem
