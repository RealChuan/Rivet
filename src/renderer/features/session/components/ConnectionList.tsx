import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plug } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type SortOrder } from '@shared/constants/index.js'
import { type ConnectionConfig, type Session } from '@shared/types/index.js'
import DragOverlayContent from './DragOverlayContent.js'
import SortableConnectionItem from './SortableConnectionItem.js'
import SortButton from './SortButton.js'

interface ConnectionListProps {
  connections: ConnectionConfig[]
  activeSessionId: string | undefined
  sortOrder: SortOrder
  onSortClick: () => void
  onReorderConnections: (activeId: string, overId: string) => void
  onSelectSession: (sessionId: string) => void
  onDisconnect: (connectionId: string) => void
  onReconnect: (connection: ConnectionConfig) => void
  onEdit: (connection: ConnectionConfig) => void
  onDelete: (connectionId: string) => void
  getSessionByConnectionId: (id: string) => Session | undefined
}

export const ConnectionList = ({
  connections,
  activeSessionId,
  sortOrder,
  onSortClick,
  onReorderConnections,
  onSelectSession,
  onDisconnect,
  onReconnect,
  onEdit,
  onDelete,
  getSessionByConnectionId,
}: ConnectionListProps) => {
  const { t } = useTranslation()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      void onReorderConnections(String(active.id), String(over.id))
    }
  }

  if (connections.length === 0) {
    return (
      <div className="px-4 py-6 text-center h-full flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-hover flex items-center justify-center">
          <Plug className="w-4 h-4 stroke-text-muted stroke-[1.5]" />
        </div>
        <div>
          <p className="text-xs text-text-muted">{t(($) => $.connection.noConnections)}</p>
          <p className="text-xs text-text-muted opacity-70">
            {t(($) => $.connection.newConnectionHint)}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-muted uppercase tracking-[0.5px]">
          {t(($) => $.connection.connections)}
        </span>
        <SortButton sortOrder={sortOrder} onClick={onSortClick} />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-auto px-2 pb-2 space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={connections.map((c) => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {connections.map((connection) => {
              const session = getSessionByConnectionId(connection.id)
              return (
                <SortableConnectionItem
                  key={connection.id}
                  connection={connection}
                  session={session}
                  isActive={session !== undefined && session.sessionId === activeSessionId}
                  onSelect={() => session && onSelectSession(session.sessionId)}
                  onDisconnect={() => void onDisconnect(connection.id)}
                  onReconnect={() => void onReconnect(connection)}
                  onEdit={() => void onEdit(connection)}
                  onDelete={() => onDelete(connection.id)}
                />
              )
            })}
          </SortableContext>

          <DragOverlayContent
            connections={connections}
            getSessionByConnectionId={getSessionByConnectionId}
          />
        </DndContext>
      </div>
    </div>
  )
}

export default ConnectionList
