import { describe, expect, it } from 'vitest'
import { encodePng, renderLogoPng, renderLogoRgba } from './tray-icon.js'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('renderLogoRgba', () => {
  it('圆角外透明，中心是白色铆钉头', () => {
    const size = 16
    const rgba = renderLogoRgba(size)

    expect(rgba[3]).toBe(0)

    const center = ((size / 2) * size + size / 2) * 4
    expect(rgba[center + 3]).toBe(255)
    expect(rgba[center]).toBeGreaterThan(200)
    expect(rgba[center + 1]).toBeGreaterThan(200)
    expect(rgba[center + 2]).toBeGreaterThan(200)
  })

  it('渐变从左上蓝色过渡到右下紫色', () => {
    const size = 32
    const rgba = renderLogoRgba(size)
    // 取铆钉头之外、圆角之内的两点：左侧 t≈0.28，右侧 t≈0.64。
    const left = (14 * size + 4) * 4
    const right = (14 * size + 27) * 4

    expect(rgba[left + 3]).toBe(255)
    expect(rgba[right + 3]).toBe(255)
    // 越靠右下红色越强、绿色越弱（蓝通道两端几乎相同，不作为判据）。
    expect(rgba[right]).toBeGreaterThan(rgba[left] ?? 0)
    expect(rgba[right + 1]).toBeLessThan(rgba[left + 1] ?? 0)
  })
})

describe('encodePng', () => {
  it('输出合法的 PNG 头与 IEND', () => {
    const png = renderLogoPng(16)

    expect([...png.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
    expect(png.readUInt32BE(16)).toBe(16)
    expect(png.readUInt32BE(20)).toBe(16)
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe('IEND')
  })

  it('尺寸随输入变化', () => {
    const png = encodePng(32, 32, Buffer.alloc(32 * 32 * 4))

    expect(png.readUInt32BE(16)).toBe(32)
    expect(png.readUInt32BE(20)).toBe(32)
  })
})
