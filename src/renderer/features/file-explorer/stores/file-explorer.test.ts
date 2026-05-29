import { beforeEach, describe, expect, it } from 'vitest'
import { useFileExplorerStore } from './file-explorer.js'

describe('file-explorer store', () => {
  beforeEach(() => {
    useFileExplorerStore.setState({
      sortField: 'name',
      sortOrder: 'asc',
      viewMode: 'list',
      showHiddenFiles: false,
      selectedFiles: new Set(),
    })
  })

  describe('initial state', () => {
    it('should have correct default values', () => {
      const state = useFileExplorerStore.getState()
      expect(state.sortField).toBe('name')
      expect(state.sortOrder).toBe('asc')
      expect(state.viewMode).toBe('list')
      expect(state.showHiddenFiles).toBe(false)
      expect(state.selectedFiles.size).toBe(0)
    })
  })

  describe('setSortField', () => {
    it('should set sort field and reset order to asc when field changes', () => {
      useFileExplorerStore.setState({ sortOrder: 'desc' })
      useFileExplorerStore.getState().setSortField('size')
      expect(useFileExplorerStore.getState().sortField).toBe('size')
      expect(useFileExplorerStore.getState().sortOrder).toBe('asc')
    })

    it('should keep current order when setting same field', () => {
      useFileExplorerStore.setState({ sortOrder: 'desc' })
      useFileExplorerStore.getState().setSortField('name')
      expect(useFileExplorerStore.getState().sortOrder).toBe('desc')
    })
  })

  describe('setSortOrder', () => {
    it('should set sort order', () => {
      useFileExplorerStore.getState().setSortOrder('desc')
      expect(useFileExplorerStore.getState().sortOrder).toBe('desc')
    })
  })

  describe('toggleSortOrder', () => {
    it('should toggle from asc to desc', () => {
      useFileExplorerStore.getState().toggleSortOrder()
      expect(useFileExplorerStore.getState().sortOrder).toBe('desc')
    })

    it('should toggle from desc to asc', () => {
      useFileExplorerStore.setState({ sortOrder: 'desc' })
      useFileExplorerStore.getState().toggleSortOrder()
      expect(useFileExplorerStore.getState().sortOrder).toBe('asc')
    })
  })

  describe('setViewMode', () => {
    it('should set view mode', () => {
      useFileExplorerStore.getState().setViewMode('grid')
      expect(useFileExplorerStore.getState().viewMode).toBe('grid')
    })
  })

  describe('setShowHiddenFiles', () => {
    it('should set show hidden files', () => {
      useFileExplorerStore.getState().setShowHiddenFiles(true)
      expect(useFileExplorerStore.getState().showHiddenFiles).toBe(true)
    })
  })

  describe('toggleShowHiddenFiles', () => {
    it('should toggle show hidden files', () => {
      useFileExplorerStore.getState().toggleShowHiddenFiles()
      expect(useFileExplorerStore.getState().showHiddenFiles).toBe(true)
    })
  })

  describe('selectedFiles', () => {
    it('should add selected file', () => {
      useFileExplorerStore.getState().addSelectedFile('file1.txt')
      expect(useFileExplorerStore.getState().selectedFiles.has('file1.txt')).toBe(true)
    })

    it('should remove selected file', () => {
      useFileExplorerStore.getState().addSelectedFile('file1.txt')
      useFileExplorerStore.getState().removeSelectedFile('file1.txt')
      expect(useFileExplorerStore.getState().selectedFiles.has('file1.txt')).toBe(false)
    })

    it('should clear selected files', () => {
      useFileExplorerStore.getState().addSelectedFile('file1.txt')
      useFileExplorerStore.getState().addSelectedFile('file2.txt')
      useFileExplorerStore.getState().clearSelectedFiles()
      expect(useFileExplorerStore.getState().selectedFiles.size).toBe(0)
    })

    it('should toggle selected file on', () => {
      useFileExplorerStore.getState().toggleSelectedFile('file1.txt')
      expect(useFileExplorerStore.getState().selectedFiles.has('file1.txt')).toBe(true)
    })

    it('should toggle selected file off', () => {
      useFileExplorerStore.getState().addSelectedFile('file1.txt')
      useFileExplorerStore.getState().toggleSelectedFile('file1.txt')
      expect(useFileExplorerStore.getState().selectedFiles.has('file1.txt')).toBe(false)
    })

    it('should set selected files', () => {
      useFileExplorerStore.getState().setSelectedFiles(new Set(['a', 'b']))
      expect(useFileExplorerStore.getState().selectedFiles.size).toBe(2)
    })
  })
})
