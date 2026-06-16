import { describe, expect, it } from 'vitest'
import { generateUniqueFilename } from './generate-unique-filename.js'

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

  it('should produce different names when called at different times', async () => {
    const result1 = generateUniqueFilename('test.txt')
    // Wait at least 1ms to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 2))
    const result2 = generateUniqueFilename('test.txt')
    expect(result1).not.toBe(result2)
  })

  it('should handle hidden file with extension', () => {
    // .config.txt: lastIndexOf('.') returns 7, extIndex > 0 => name='.config', ext='.txt'
    const result = generateUniqueFilename('.config.txt')
    expect(result).toMatch(/^\.config_\d{8}_\d{6}_\d{3}\.txt$/)
  })

  it('should handle filename ending with dot', () => {
    // 'file.': lastIndexOf('.') returns 4, extIndex > 0 => name='file', ext='.'
    const result = generateUniqueFilename('file.')
    expect(result).toMatch(/^file_\d{8}_\d{6}_\d{3}\.$/)
  })

  it('should handle empty string', () => {
    // '': lastIndexOf('.') returns -1, extIndex > 0 is false => name='', ext=''
    const result = generateUniqueFilename('')
    expect(result).toMatch(/^_\d{8}_\d{6}_\d{3}$/)
  })

  it('should handle filename with spaces', () => {
    const result = generateUniqueFilename('my document.pdf')
    expect(result).toMatch(/^my document_\d{8}_\d{6}_\d{3}\.pdf$/)
  })

  it('should produce timestamp close to current time', () => {
    const before = Date.now()
    const result = generateUniqueFilename('test.txt')
    const after = Date.now()

    // Extract timestamp from result
    const match = result.match(/test_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(\d{3})\.txt/)
    expect(match).not.toBeNull()

    const parts = match as RegExpMatchArray
    const [, year, month, day, hour, minute, second, ms] = parts
    const generatedDate = new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
        Number(ms)
      )
    )
    const generatedTime = generatedDate.getTime()
    // Allow for timezone offset and small delay
    expect(generatedTime).toBeGreaterThanOrEqual(before - 24 * 60 * 60 * 1000)
    expect(generatedTime).toBeLessThanOrEqual(after + 24 * 60 * 60 * 1000)
  })
})
