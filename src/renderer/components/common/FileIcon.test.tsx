import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FileIcon, resolveFileKind } from './FileIcon.js'

describe('FileIcon', () => {
  it('should render file icon for file type', () => {
    const { container } = render(<FileIcon type="file" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('should render directory icon for directory type', () => {
    const { container } = render(<FileIcon type="directory" />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
  })

  it('should apply default size classes', () => {
    const { container } = render(<FileIcon type="file" />)
    const svg = container.querySelector('svg')
    if (!svg) throw new Error('SVG not found')
    const classList = svg.getAttribute('class') ?? ''
    expect(classList).toContain('w-4')
    expect(classList).toContain('h-4')
  })

  it('should apply custom className', () => {
    const { container } = render(<FileIcon type="file" className="w-6 h-6" />)
    const svg = container.querySelector('svg')
    if (!svg) throw new Error('SVG not found')
    const classList = svg.getAttribute('class') ?? ''
    expect(classList).toContain('w-6')
    expect(classList).toContain('h-6')
  })

  it('should render directory icon with fill color', () => {
    const { container } = render(<FileIcon type="directory" />)
    const svg = container.querySelector('svg')
    if (!svg) throw new Error('SVG not found')
    const path = svg.querySelector('path')
    expect(path).not.toBeNull()
    expect(svg.getAttribute('fill')).not.toBeNull()
  })

  it('should render file icon with stroke', () => {
    const { container } = render(<FileIcon type="file" />)
    const svg = container.querySelector('svg')
    if (!svg) throw new Error('SVG not found')
    expect(svg.getAttribute('stroke')).not.toBeNull()
  })

  it('should render different SVGs for file and directory', () => {
    const { container: fileContainer } = render(<FileIcon type="file" />)
    const { container: dirContainer } = render(<FileIcon type="directory" />)
    const fileSvg = fileContainer.querySelector('svg')
    const dirSvg = dirContainer.querySelector('svg')
    if (!fileSvg || !dirSvg) throw new Error('SVGs not found')
    expect(fileSvg.innerHTML).not.toBe(dirSvg.innerHTML)
  })

  it('按后缀区分图标分类', () => {
    expect(resolveFileKind('photo.JPG')).toBe('image')
    expect(resolveFileKind('movie.mp4')).toBe('video')
    expect(resolveFileKind('song.flac')).toBe('audio')
    expect(resolveFileKind('bundle.zip')).toBe('archive')
    expect(resolveFileKind('report.xlsx')).toBe('spreadsheet')
    expect(resolveFileKind('deck.pptx')).toBe('presentation')
    expect(resolveFileKind('main.tsx')).toBe('code')
    expect(resolveFileKind('config.yaml')).toBe('data')
    expect(resolveFileKind('dump.sqlite')).toBe('database')
    expect(resolveFileKind('id_rsa.pem')).toBe('key')
  })

  it('未知后缀与无后缀回退通用文件图标', () => {
    expect(resolveFileKind('archive.unknownext')).toBe('file')
    expect(resolveFileKind('no-extension')).toBe('file')
    expect(resolveFileKind('')).toBe('file')
  })

  it('点开头的约定文件名按名字分类', () => {
    expect(resolveFileKind('.gitignore')).toBe('data')
    expect(resolveFileKind('Dockerfile')).toBe('code')
    expect(resolveFileKind('.unknownrc')).toBe('file')
  })

  it('不同后缀渲染不同图标', () => {
    const { container: zipContainer } = render(<FileIcon type="file" name="a.zip" />)
    const { container: pdfContainer } = render(<FileIcon type="file" name="a.pdf" />)
    const zipSvg = zipContainer.querySelector('svg')
    const pdfSvg = pdfContainer.querySelector('svg')
    if (!zipSvg || !pdfSvg) throw new Error('SVGs not found')
    expect(zipSvg.innerHTML).not.toBe(pdfSvg.innerHTML)
  })
})
