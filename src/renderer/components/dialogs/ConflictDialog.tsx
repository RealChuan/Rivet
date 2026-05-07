import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileInfo } from '@shared/types'
import GlassDialog from './GlassDialog'
import logger from '../../utils/logger'

export type ConflictStrategy = 'overwrite' | 'skip' | 'keepBoth'

export interface ConflictItem {
  sourceFile: FileInfo
  targetFile: FileInfo | null
  targetExists: boolean
}

export interface ConflictResolution {
  sourceFile: FileInfo
  targetFile: FileInfo
  strategy: ConflictStrategy
}

interface ConflictDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (resolutions: ConflictResolution[]) => void
  conflicts: ConflictItem[]
  operation?: 'copy' | 'move'
  files?: FileInfo[]
  targetDir?: FileInfo
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  open,
  onClose,
  onConfirm,
  conflicts,
  operation,
  files,
  targetDir,
}) => {
  const { t } = useTranslation()
  const [resolutions, setResolutions] = useState<ConflictResolution[]>([])
  const [applyToAll, setApplyToAll] = useState(false)
  const [globalStrategy, setGlobalStrategy] = useState<ConflictStrategy>(
    operation === 'move' ? 'keepBoth' : 'overwrite'
  )

  React.useEffect(() => {}, [])

  React.useEffect(() => {
    if (open && conflicts.length > 0) {
      const defaultStrategy: ConflictStrategy = operation === 'move' ? 'keepBoth' : 'overwrite'
      const initialResolutions: ConflictResolution[] = conflicts.map(c => ({
        sourceFile: c.sourceFile,
        targetFile: c.targetFile || c.sourceFile,
        strategy: defaultStrategy,
      }))
      setResolutions(initialResolutions)
      setApplyToAll(false)
    }
  }, [open, conflicts])

  const handleStrategyChange = (index: number, strategy: ConflictStrategy) => {
    if (applyToAll) {
      const newResolutions = resolutions.map(r => ({ ...r, strategy }))
      setResolutions(newResolutions)
      setGlobalStrategy(strategy)
    } else {
      const newResolutions = [...resolutions]
      newResolutions[index] = { ...newResolutions[index], strategy }
      setResolutions(newResolutions)
    }
  }

  const handleConfirm = async () => {
    logger.info('[Copy] ConflictDialog handleConfirm called')
    if (onConfirm) {
      await onConfirm(resolutions, operation, files, targetDir)
    }
    onClose()
  }

  const canOverwrite = (conflict: ConflictItem) => {
    return conflict.sourceFile.type === conflict.targetFile?.type
  }

  if (!open) return null

  return (
    <GlassDialog open={open} onClose={onClose} width={700} height={550}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '502px',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text)' }}>
            {t('dialog.conflict.title')}
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              borderRadius: '4px',
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            padding: '8px',
            backgroundColor: 'var(--background)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            minHeight: '40px',
          }}
        >
          {conflicts.map((conflict, index) => {
            const resolution = resolutions[index] || {
              sourceFile: conflict.sourceFile,
              targetFile: conflict.targetFile || conflict.sourceFile,
              strategy: 'overwrite' as const,
            }
            const cannotOverwrite = !canOverwrite(conflict)

            return (
              <div
                key={conflict.sourceFile.absolutePath}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--hover)',
                  borderRadius: '6px',
                  marginBottom: '8px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        {conflict.sourceFile.type === 'directory' ? (
                          <path
                            d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                            fill="var(--warning)"
                            stroke="none"
                          />
                        ) : (
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        )}
                      </svg>
                      <span style={{ fontSize: '13px', color: 'var(--text)', fontWeight: 500 }}>
                        {conflict.sourceFile.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {t('dialog.conflict.source')}: {conflict.sourceFile.absolutePath}
                    </div>
                  </div>

                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        {conflict.targetFile?.type === 'directory' ? (
                          <path
                            d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                            fill="var(--warning)"
                            stroke="none"
                          />
                        ) : (
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                        )}
                      </svg>
                      <span style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 500 }}>
                        {conflict.targetFile?.name || conflict.sourceFile.name}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {t('dialog.conflict.target')}:{' '}
                      {conflict.targetFile?.absolutePath || conflict.sourceFile.absolutePath}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => handleStrategyChange(index, 'skip')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      backgroundColor:
                        resolution.strategy === 'skip' ? 'var(--hover)' : 'transparent',
                      color: 'var(--text)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                    onMouseLeave={e =>
                      (e.currentTarget.style.backgroundColor =
                        resolution.strategy === 'skip' ? 'var(--hover)' : 'transparent')
                    }
                  >
                    {t('dialog.conflict.skip')}
                  </button>
                  <button
                    onClick={() => handleStrategyChange(index, 'keepBoth')}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: '1px solid var(--border)',
                      backgroundColor:
                        resolution.strategy === 'keepBoth' ? 'var(--hover)' : 'transparent',
                      color: 'var(--text)',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                    onMouseLeave={e =>
                      (e.currentTarget.style.backgroundColor =
                        resolution.strategy === 'keepBoth' ? 'var(--hover)' : 'transparent')
                    }
                  >
                    {t('dialog.conflict.keepBoth')}
                  </button>
                  {operation !== 'move' && (
                    <button
                      onClick={() => handleStrategyChange(index, 'overwrite')}
                      disabled={cannotOverwrite}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor:
                          resolution.strategy === 'overwrite'
                            ? 'var(--accent)'
                            : cannotOverwrite
                              ? 'var(--disabled)'
                              : 'var(--accent)',
                        color: '#fff',
                        fontSize: '12px',
                        cursor: cannotOverwrite ? 'not-allowed' : 'pointer',
                        opacity: cannotOverwrite ? 0.5 : 1,
                      }}
                      onMouseEnter={e =>
                        !cannotOverwrite && (e.currentTarget.style.opacity = '0.9')
                      }
                      onMouseLeave={e => !cannotOverwrite && (e.currentTarget.style.opacity = '1')}
                    >
                      {t('dialog.conflict.overwrite')}
                    </button>
                  )}
                </div>

                {cannotOverwrite && operation !== 'move' && (
                  <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--danger)' }}>
                    {t('dialog.conflict.cannotOverwrite')}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '16px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={e => setApplyToAll(e.target.checked)}
              style={{ width: '14px', height: '14px' }}
            />
            {t('dialog.conflict.applyToAll')}
          </label>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                backgroundColor: 'transparent',
                color: 'var(--text)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              {t('dialog.cancel')}
            </button>
            <button
              onClick={handleConfirm}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                backgroundColor: 'var(--accent)',
                color: '#ffffff',
                fontSize: '13px',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              {t('dialog.confirm')}
            </button>
          </div>
        </div>

        {applyToAll && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              backgroundColor: 'var(--hover)',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {t('dialog.conflict.globalAction')}:
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => {
                  setGlobalStrategy('skip')
                  setResolutions(resolutions.map(r => ({ ...r, strategy: 'skip' })))
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  backgroundColor: globalStrategy === 'skip' ? 'var(--hover)' : 'transparent',
                  color: 'var(--text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                onMouseLeave={e =>
                  (e.currentTarget.style.backgroundColor =
                    globalStrategy === 'skip' ? 'var(--hover)' : 'transparent')
                }
              >
                {t('dialog.conflict.skip')}
              </button>
              <button
                onClick={() => {
                  setGlobalStrategy('keepBoth')
                  setResolutions(resolutions.map(r => ({ ...r, strategy: 'keepBoth' })))
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  backgroundColor: globalStrategy === 'keepBoth' ? 'var(--hover)' : 'transparent',
                  color: 'var(--text)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                onMouseLeave={e =>
                  (e.currentTarget.style.backgroundColor =
                    globalStrategy === 'keepBoth' ? 'var(--hover)' : 'transparent')
                }
              >
                {t('dialog.conflict.keepBoth')}
              </button>
              {operation !== 'move' && (
                <button
                  onClick={() => {
                    setGlobalStrategy('overwrite')
                    setResolutions(resolutions.map(r => ({ ...r, strategy: 'overwrite' })))
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '4px',
                    border: 'none',
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                >
                  {t('dialog.conflict.overwrite')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </GlassDialog>
  )
}

export default ConflictDialog
