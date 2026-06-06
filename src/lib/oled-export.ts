import type { OLEDFrame } from '../types'

/** Format byte as 0xNN hex matching project Diode[] style (lowercase x, uppercase hex) */
function hexByte(b: number): string {
  return '0x' + b.toString(16).toUpperCase().padStart(2, '0')
}

/** Generate complete video_frames.h file content matching project OLED_Data.c Diode[] style */
export function generateVideoHeader(frames: OLEDFrame[], fps: number): string {
  const frameCount = frames.length
  const lines: string[] = []

  lines.push('#ifndef __VIDEO_FRAMES_H')
  lines.push('#define __VIDEO_FRAMES_H')
  lines.push('')
  lines.push('#include <stdint.h>')
  lines.push('')
  lines.push('/* Auto-generated video frames for SSD1306 OLED (128x64)')
  lines.push(`   Frames: ${frameCount}, FPS: ${fps}`)
  lines.push(`   Total: ${frameCount * 1024} bytes (${(frameCount * 1024 / 1024).toFixed(1)} KB)`)
  lines.push('*/')
  lines.push('')
  lines.push(`#define VIDEO_FRAME_COUNT ${frameCount}`)
  lines.push(`#define VIDEO_FPS ${fps}`)
  lines.push('')

  for (let f = 0; f < frameCount; f++) {
    const name = `video_frame_${String(f).padStart(3, '0')}`
    const data = frames[f]
    lines.push(`const uint8_t ${name}[1024] = {`)

    for (let i = 0; i < 1024; i += 16) {
      const row: string[] = []
      for (let j = i; j < i + 16 && j < 1024; j++) {
        row.push(hexByte(data[j]))
      }
      const comma = (i + 16 < 1024) ? ',' : ''
      lines.push('\t' + row.join(',') + comma)
    }

    lines.push('};')
    lines.push('')
  }

  lines.push('#endif')
  return lines.join('\n')
}

/** Trigger .h file download in browser */
export function downloadHeader(frames: OLEDFrame[], fps: number): void {
  const content = generateVideoHeader(frames, fps)
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'video_frames.h'
  a.click()
  URL.revokeObjectURL(url)
}
