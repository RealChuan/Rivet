import React, { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { FileInfo } from '../../../shared/types.js'
import GlassDialog from './GlassDialog.js'
import VirtualList from '../VirtualList.js'
import { useUiStore } from '../../stores/uiStore.js'
import InputDialog from './InputDialog.js'
import Button from '../ui/Button.js'
import Breadcrumb from '../FileArea/Breadcrumb.js'
import FileIcon from '../ui/FileIcon.js'

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
      const result = await window.electronAPI.protocol.list(sessionId, currentPath)
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
      await window.electronAPI.protocol.mkdir(sessionId, newFolderPath)
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

          <div className="pb-3 border-b border-border mb-3 shrink-0">
            <Breadcrumb path={currentPath} sessionId={sessionId} onNavigate={setCurrentPath} />
          </div>

          <div className="flex-1 overflow-y-auto min-h-10">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-text-muted">{t('fileList.loading')}</div>
              </div>
            ) : folders.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-xs text-text-muted">{t('fileList.empty')}</div>
              </div>
            ) : (
              <VirtualList
                items={allItems}
                itemHeight={40}
                width="100%"
                renderItem={(item, _index, style) => {
                  if (item.isParent || item.name === '..') {
                    return (
                      <button
                        key=".."
                        onClick={handleParentDirectory}
                        className={`
                          flex items-center gap-2 h-10 px-3 cursor-pointer
                          border-none rounded transition-all duration-100
                          bg-transparent text-text hover:bg-hover
                        `}
                        style={{ ...style, width: '100%' }}
                        title={t('fileList.parentDirectory')}
                      >
                        <svg
                          className="w-4 h-4 stroke-text-muted stroke-2"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <polyline points="15 18 9 12 15 6" />
                        </svg>
                        <span className="text-sm">{t('fileList.parentDirectory')}</span>
                      </button>
                    )
                  }
                  const isSelected = selectedFolder?.name === item.name
                  return (
                    <button
                      key={item.name}
                      onClick={() => setSelectedFolder(item)}
                      onDoubleClick={() => handleNavigate(item)}
                      className={`
                        flex items-center gap-2 h-10 px-3 cursor-pointer
                        border-none rounded transition-all duration-100
                        ${isSelected ? 'bg-selected text-accent' : 'bg-transparent text-text hover:bg-hover'}
                      `}
                      style={{ ...style, width: '100%' }}
                      title={item.name}
                    >
                      <FileIcon type="directory" />
                      <span className="flex-1 text-sm text-left overflow-hidden text-ellipsis whitespace-nowrap">
                        {item.name}
                      </span>
                      <svg
                        className={`w-4 h-4 stroke-1.5 transition-colors ${isSelected ? 'stroke-accent' : 'stroke-text-muted'}`}
                        viewBox="0 0 24 24"
                        fill="none"
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
                className={`
                  p-1.5 rounded flex items-center justify-center
                  border-none cursor-pointer transition-all duration-150
                  text-text hover:bg-hover
                `}
              >
                <svg className="w-4 h-4 stroke-current stroke-2" viewBox="0 0 24 24" fill="none">
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
            <div className="flex gap-2.5">
              <Button variant="secondary" onClick={onClose}>
                {t('dialog.cancel')}
              </Button>
              <Button variant="primary" onClick={handleConfirm}>
                {t('dialog.confirm')}
              </Button>
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
