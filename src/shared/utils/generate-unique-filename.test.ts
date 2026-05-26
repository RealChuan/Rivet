import { describe, it, expect } from 'vitest'
import { generateUniqueFilename } from './index.js'

describe('generateUniqueFilename', () => {
  it('should append timestamp before extension', () => {
    const result = generateUniqueFilename('document.pdf')
    expect(result).toMatch(/^document_\d{8}_\d{6}_\d{3}\.pdf$/)
  })

  it('should handle filename without extension', () => {
    const result = generateUniqueFilename('README')
    expect(result).toMatch(/^README_\d{8}_\d{6}_\d{3}$/)
  })

  it('should handle filename with multiple dots', () => {
    const result = generateUniqueFilename('archive.tar.gz')
    expect(result).toMatch(/^archive\.tar_\d{8}_\d{6}_\d{3}\.gz$/)
  })

  it('should handle hidden file starting with dot', () => {
    const result = generateUniqueFilename('.bashrc')
    expect(result).toMatch(/^\.bashrc_\d{8}_\d{6}_\d{3}$/)
  })

  it('should include timestamp in generated name', () => {
    const result = generateUniqueFilename('file.txt')
    expect(result).toMatch(/^file_\d{8}_\d{6}_\d{3}\.txt$/)
  })
})
