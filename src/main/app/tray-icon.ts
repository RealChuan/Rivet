import { nativeImage, type NativeImage } from 'electron'
import { deflateSync } from 'node:zlib'

/**
 * 托盘图标：把标题栏的 AppLogo（圆角渐变方块 + 铆钉头）画成像素，透明背景。
 * `createFromBitmap` 的像素通道顺序随平台变化，彩色图会偏色，所以这里自己编码 PNG。
 */

interface Rgba {
  r: number
  g: number
  b: number
}

const LOGO_START: Rgba = { r: 0x25, g: 0x63, b: 0xeb }
const LOGO_END: Rgba = { r: 0x7c, g: 0x3a, b: 0xed }
/** 每个像素 4×4 超采样，边缘靠覆盖率抗锯齿。 */
const SUPERSAMPLE = 4

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let value = n
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[n] = value >>> 0
  }
  return table
})()

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** 最小 PNG 编码器：8 位 RGBA、无滤波、单 IDAT。 */
export function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0

  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function insideRoundedSquare(x: number, y: number, size: number, radius: number): boolean {
  const edgeX = Math.min(x, size - x)
  const edgeY = Math.min(y, size - y)
  if (edgeX <= 0 || edgeY <= 0) return false
  if (edgeX >= radius || edgeY >= radius) return true

  const dx = radius - edgeX
  const dy = radius - edgeY
  return dx * dx + dy * dy <= radius * radius
}

function mix(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

function sample(px: number, py: number, size: number): Rgba & { a: number } {
  const radius = size * 0.22
  if (!insideRoundedSquare(px, py, size, radius)) return { r: 0, g: 0, b: 0, a: 0 }

  const t = (px + py) / (2 * size)
  const base: Rgba = {
    r: mix(LOGO_START.r, LOGO_END.r, t),
    g: mix(LOGO_START.g, LOGO_END.g, t),
    b: mix(LOGO_START.b, LOGO_END.b, t),
  }

  const center = (size - 1) / 2
  const distance = Math.hypot(px - center, py - center)
  let { r, g, b } = base

  if (distance <= size * 0.34) {
    // 铆钉头
    r = mix(r, 255, 0.92)
    g = mix(g, 255, 0.92)
    b = mix(b, 255, 0.92)
  }
  if (distance <= size * 0.12) {
    // 中心凹痕
    r = mix(r, 255, 0.35)
    g = mix(g, 255, 0.35)
    b = mix(b, 255, 0.35)
  }

  return { r, g, b, a: 1 }
}

/** 画好的 RGBA 像素（未编码），测试直接断言它。 */
export function renderLogoRgba(size: number): Buffer {
  const output = Buffer.alloc(size * size * 4)
  const samples = SUPERSAMPLE * SUPERSAMPLE

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0
      let g = 0
      let b = 0
      let alpha = 0

      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const pixel = sample(
            x * SUPERSAMPLE + sx + 0.5,
            y * SUPERSAMPLE + sy + 0.5,
            size * SUPERSAMPLE,
          )
          r += pixel.r * pixel.a
          g += pixel.g * pixel.a
          b += pixel.b * pixel.a
          alpha += pixel.a
        }
      }

      const offset = (y * size + x) * 4
      if (alpha > 0) {
        output[offset] = Math.round(r / alpha)
        output[offset + 1] = Math.round(g / alpha)
        output[offset + 2] = Math.round(b / alpha)
      }
      output[offset + 3] = Math.round((alpha / samples) * 255)
    }
  }

  return output
}

export function renderLogoPng(size: number): Buffer {
  return encodePng(size, size, renderLogoRgba(size))
}

/** 16px 为主图，32px 作为 2× 表示，tray 在 HiDPI 屏上不糊。 */
export function createTrayImage(): NativeImage {
  const image = nativeImage.createFromBuffer(renderLogoPng(16), { scaleFactor: 1 })
  image.addRepresentation({ scaleFactor: 2, buffer: renderLogoPng(32) })
  return image
}
