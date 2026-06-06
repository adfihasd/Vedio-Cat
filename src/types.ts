/** Video metadata from ffmpeg */
export interface VideoInfo {
  duration: number   // seconds
  width: number
  height: number
  name: string
}

/** A processed OLED frame: 1024 bytes in SSD1306 page-column format */
export type OLEDFrame = Uint8Array  // length 1024

/** Supported dithering algorithms */
export type DitherAlgorithm = 'threshold' | 'floyd-steinberg' | 'atkinson'

export const DITHER_OPTIONS: { key: DitherAlgorithm; label: string }[] = [
  { key: 'threshold', label: '简单阈值' },
  { key: 'floyd-steinberg', label: 'Floyd-Steinberg' },
  { key: 'atkinson', label: 'Atkinson' },
]

/** App state machine steps */
export type AppStep = 1 | 2 | 3 | 4
