import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDERER_ROOT = join(process.cwd(), 'src/renderer')

function collect(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...collect(fullPath))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue
    if (entry.name.includes('.test.')) continue
    files.push(fullPath)
  }
  return files
}

describe('renderer boundaries', () => {
  it('除 api/ 外没有任何文件引用 window.electronAPI', () => {
    const offenders = collect(RENDERER_ROOT)
      .filter((file) => !/[\\/]api[\\/]/.test(file))
      .filter((file) => readFileSync(file, 'utf8').includes('window.electronAPI'))

    expect(offenders).toEqual([])
  })

  it('不引用散装 @radix-ui/react-* 包', () => {
    const offenders = collect(RENDERER_ROOT).filter((file) =>
      readFileSync(file, 'utf8').includes('@radix-ui/react-'),
    )

    expect(offenders).toEqual([])
  })

  it('不引用 react-window / react-virtualized-auto-sizer', () => {
    const offenders = collect(RENDERER_ROOT).filter((file) => {
      const source = readFileSync(file, 'utf8')
      return source.includes('react-window') || source.includes('react-virtualized-auto-sizer')
    })

    expect(offenders).toEqual([])
  })
})
