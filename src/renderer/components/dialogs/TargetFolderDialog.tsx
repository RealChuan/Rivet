import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileInfo } from '@shared/types'
import GlassDialog from './GlassDialog'
import VirtualList from '../VirtualList'
import { useUiStore } from '../../stores/uiStore'
import InputDialog from './InputDialog'

interface TargetFolderDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: (targetDir: FileInfo) => void
  sessionId: string
}

interface FolderItem extends FileInfo {
  isParent?: boolean
}

export const TargetFolderDialog: React.FC<TargetFolderDialogProps> = ({
  open,
  onClose,
  onConfirm,
  sessionId,
}) => {
  const { t } = useTranslation()
  const { addToast } = useUiStore()
  const [currentPath, setCurrentPath] = useState('/')
  const [folders, setFolders] = useState<FolderItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<FolderItem | null>(null)
  const [newFolderDialogOpen, setNewFolderDialogOpen] = useState(false)

  const loadFolders = useCallback(async () => {
    if (!open) return
    setIsLoading(true)
    try {
      const result = await window.electronAPI.list(sessionId, currentPath)
      const dirs = result
        .filter((f: FileInfo) => f.type === 'directory')
        .map(f => ({ ...f })) as FolderItem[]
      dirs.sort((a, b) => a.name.localeCompare(b.name))
      setFolders(dirs)
    } catch (error) {
      console.error('Failed to load folders:', error)
    } finally {
      setIsLoading(false)
    }
  }, [open, sessionId, currentPath])

  useEffect(() => {
    if (open) {
      setCurrentPath('/')
      setSelectedFolder(null)
      loadFolders()
    }
  }, [open])

  useEffect(() => {
    if (open) loadFolders()
  }, [currentPath, open])

  const handleNavigate = (folder: FolderItem) => {
    setCurrentPath(folder.absolutePath)
    setSelectedFolder(null)
  }

  const handleParentDirectory = () => {
    if (currentPath === '/') return
    const parts = currentPath.split('/').filter(Boolean)
    const parentPath = parts.length === 0 ? '/' : '/' + parts.slice(0, -1).join('/')
    setCurrentPath(parentPath)
    setSelectedFolder(null)
  }

  const handleNewFolder = async (folderName: string) => {
    const newFolderPath = currentPath === '/' ? `/${folderName}` : `${currentPath}/${folderName}`

    try {
      await window.electronAPI.mkdir(sessionId, newFolderPath)
      addToast({ type: 'success', message: t('toast.createFolderSuccess') })
      await loadFolders()
    } catch (error) {
      addToast({
        type: 'error',
        message: `${t('toast.createFolderFailed')}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }

  const handleConfirm = async () => {
    const targetDir: FileInfo = selectedFolder || {
      name: currentPath === '/' ? '/' : currentPath.split('/').pop() || '',
      type: 'directory',
      size: 0,
      modifyTime: 0,
      absolutePath: currentPath,
    }
    await onConfirm(targetDir)
    await Promise.resolve()
    onClose()
  }

  if (!open) return null

  const pathParts = currentPath.split('/').filter(Boolean)

  const parentItem: FolderItem = {
    name: '..',
    type: 'directory',
    isParent: true,
    size: 0,
    modifyTime: 0,
    absolutePath: currentPath.split('/').slice(0, -1).join('/') || '/',
  }

  const allItems: FolderItem[] = currentPath !== '/' ? [parentItem, ...folders] : folders

  return (
    <>
      <GlassDialog open={open} onClose={onClose} width={550} height={500}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '452px',
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
              flexShrink: 0,
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>
              {t('dialog.selectTargetFolder.title')}
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

          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              overflowX: 'auto',
              paddingBottom: '12px',
              borderBottom: '1px solid var(--border)',
              marginBottom: '12px',
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => setCurrentPath('/')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: '4px',
                color: 'var(--text)',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                fontWeight: 500,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              /
            </button>
            {pathParts.map((part, index) => {
              const fullPath = '/' + pathParts.slice(0, index + 1).join('/')
              return (
                <React.Fragment key={fullPath}>
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-muted)"
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <button
                    onClick={() => setCurrentPath(fullPath)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {part}
                  </button>
                </React.Fragment>
              )
            })}
          </nav>

          <div style={{ flex: 1, overflowY: 'auto', minHeight: '40px' }}>
            {isLoading ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('fileList.loading')}
                </div>
              </div>
            ) : folders.length === 0 ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                }}
              >
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {t('fileList.empty')}
                </div>
              </div>
            ) : (
              <VirtualList
                items={allItems}
                itemHeight={36}
                width="100%"
                renderItem={(item, _index, style) => {
                  if (item.isParent || item.name === '..') {
                    return (
                      <button
                        key=".."
                        onClick={handleParentDirectory}
                        style={{
                          ...style,
                          width: '100%',
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          color: 'var(--text)',
                          fontSize: '12px',
                          textAlign: 'left',
                          transition: 'background-color 0.15s ease',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        {t('fileList.parentDirectory')}
                      </button>
                    )
                  }
                  const isSelected = selectedFolder?.name === item.name
                  return (
                    <button
                      key={item.name}
                      onClick={() => setSelectedFolder(item)}
                      onDoubleClick={() => handleNavigate(item)}
                      style={{
                        ...style,
                        width: '100%',
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: isSelected ? 'var(--selected)' : 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                        fontSize: '12px',
                        textAlign: 'left',
                        transition: 'background-color 0.15s ease',
                      }}
                      title={item.name}
                      onMouseEnter={e => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'var(--hover)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isSelected) {
                          e.currentTarget.style.backgroundColor = 'transparent'
                        }
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill={isSelected ? 'var(--accent)' : 'var(--warning)'}
                        stroke="none"
                      >
                        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                      </svg>
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                          fontSize: '14px',
                          color: isSelected ? 'var(--accent)' : 'var(--text)',
                        }}
                      >
                        {item.name}
                      </span>
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isSelected ? 'var(--accent)' : 'var(--text-muted)'}
                        strokeWidth="1.5"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )
                }}
              />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: '12px',
              paddingTop: '12px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setNewFolderDialogOpen(true)}
                title={t('toolbar.newFolder')}
                style={{
                  padding: '6px',
                  borderRadius: '4px',
                  backgroundColor: 'transparent',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--hover)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
                  <line x1="12" y1="11" x2="12" y2="17" />
                  <line x1="9" y1="14" x2="15" y2="14" />
                </svg>
              </button>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  padding: '8px 12px',
                  backgroundColor: 'var(--hover)',
                  borderRadius: '4px',
                  maxWidth: '250px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={currentPath}
              >
                {currentPath}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={onClose}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {t('dialog.cancel')}
              </button>
              <button
                onClick={handleConfirm}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--accent)',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('dialog.confirm')}
              </button>
            </div>
          </div>
        </div>
      </GlassDialog>

      <InputDialog
        open={newFolderDialogOpen}
        onClose={() => setNewFolderDialogOpen(false)}
        onSubmit={handleNewFolder}
        title={t('dialog.newFolder.title')}
        placeholder={t('dialog.newFolder.placeholder')}
        submitText={t('dialog.ok')}
      />
    </>
  )
}

export default TargetFolderDialog
