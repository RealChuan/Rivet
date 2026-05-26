import React from 'react'
import { useTranslation } from 'react-i18next'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { type ConnectionConfig, type Session } from '@shared/types/index.js'
import { type SortOrder } from '@shared/constants/sort.js'
import SortButton from './SortButton.js'
import SortableConnectionItem from './SortableConnectionItem.js'
import DragOverlayContent from './DragOverlayContent.js'

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

export const ConnectionList: React.FC<ConnectionListProps> = ({
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
}) => {
  const { t } = useTranslation()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      void onReorderConnections(String(active.id), String(over.id))
    }
  }

  if (connections.length === 0) {
    return (
      <div className="px-4 py-6 text-center h-full flex flex-col items-center justify-center">
        <div className="w-12 h-12 mb-3 rounded-full bg-hover flex items-center justify-center">
          <svg
            className="w-5 h-5 stroke-text-muted"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="1.5"
          >
            <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </div>
        <p className="text-xs text-text-muted mb-1">{t('connection.noConnections')}</p>
        <p className="text-xs text-text-muted">{t('connection.newConnectionHint')}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 pt-3.5 pb-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-text-muted uppercase tracking-[0.5px]">
          {t('connection.connections')}
        </span>
        <SortButton sortOrder={sortOrder} onClick={onSortClick} />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={connections.map(c => c.id)}
            strategy={verticalListSortingStrategy}
          >
            {connections.map(connection => {
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
