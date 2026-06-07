import type { DitherAlgorithm, OLEDFrame } from '../types'

/** Simple threshold: pixel > thresholdValue → 1, <= thresholdValue → 0 */
export function threshold(data: Uint8Array, thresholdValue = 128): Uint8Array {
  const bin = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    bin[i] = data[i] > thresholdValue ? 1 : 0
  }
  return bin
}

/** Floyd-Steinberg error diffusion dithering */
export function floydSteinberg(data: Uint8Array, width = 128, height = 64): Uint8Array {
  const pixels = new Float32Array(data)
  const result = new Uint8Array(data.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const old = pixels[idx]
      const newVal = old > 127 ? 255 : 0
      result[idx] = newVal === 255 ? 1 : 0
      const error = old - newVal

      if (x + 1 < width)           pixels[idx + 1]         += error * 7 / 16
      if (y + 1 < height) {
        if (x - 1 >= 0)            pixels[idx + width - 1] += error * 3 / 16
                                    pixels[idx + width]     += error * 5 / 16
        if (x + 1 < width)         pixels[idx + width + 1] += error * 1 / 16
      }
    }
  }
  return result
}

/** Atkinson dithering */
export function atkinson(data: Uint8Array, width = 128, height = 64): Uint8Array {
  const pixels = new Float32Array(data)
  const result = new Uint8Array(data.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const old = pixels[idx]
      const newVal = old > 127 ? 255 : 0
      result[idx] = newVal === 255 ? 1 : 0
      const error = (old - newVal) / 8

      if (x + 1 < width)           pixels[idx + 1]         += error
      if (x + 2 < width)           pixels[idx + 2]         += error
      if (y + 1 < height) {
        if (x - 1 >= 0)            pixels[idx + width - 1] += error
                                    pixels[idx + width]     += error
        if (x + 1 < width)         pixels[idx + width + 1] += error
      }
      if (y + 2 < height)          pixels[idx + width * 2] += error
    }
  }
  return result
}

/** Pack binary data (0/1 per pixel, 128×64) into SSD1306 page-column format.
 *  8 pages × 128 columns = 1024 bytes. Each byte = 8 vertical pixels, LSB = top pixel. */
export function packOLED(binary: Uint8Array, width = 128, height = 64): OLEDFrame {
  const pages = height / 8
  const frame = new Uint8Array(width * pages)

  for (let page = 0; page < pages; page++) {
    for (let col = 0; col < width; col++) {
      let byte = 0
      for (let bit = 0; bit < 8; bit++) {
        const y = page * 8 + bit
        const idx = y * width + col
        if (binary[idx]) {
          byte |= (1 << bit)
        }
      }
      frame[page * width + col] = byte
    }
  }
  return frame
}

/** Apply dithering by name */
export function applyDither(
  data: Uint8Array,
  algorithm: DitherAlgorithm,
  width = 128,
  height = 64,
  thresholdValue = 128
): Uint8Array {
  switch (algorithm) {
    case 'threshold':       return threshold(data, thresholdValue)
    case 'floyd-steinberg': return floydSteinberg(data, width, height)
    case 'atkinson':        return atkinson(data, width, height)
  }
}

/** Full pipeline: raw grayscale → dither → OLED packed bytes */
export function processFrame(
  grayData: Uint8Array,
  algorithm: DitherAlgorithm,
  width = 128,
  height = 64,
  thresholdValue = 128
): OLEDFrame {
  const binary = applyDither(grayData, algorithm, width, height, thresholdValue)
  return packOLED(binary, width, height)
}
