import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { FileIcon } from './FileIcon.js'

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
})
