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

/** How to fit video into 128×64 OLED frame */
export type FitMode = 'stretch' | 'letterbox'

export const FIT_OPTIONS: { key: FitMode; label: string }[] = [
  { key: 'stretch', label: '拉伸填充' },
  { key: 'letterbox', label: '等比居中' },
]

/** App state machine steps */
export type AppStep = 1 | 2 | 3 | 4 | 5
