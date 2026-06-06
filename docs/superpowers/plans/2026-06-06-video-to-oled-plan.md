# Video → OLED 帧切取工具 - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a pure-frontend website that uploads video, extracts frames via ffmpeg.wasm, applies monochrome dithering for SSD1306 OLED (128×64), and exports C `.h` files matching the project's `Diode[]` data format.

**Architecture:** React + Vite SPA with a linear 4-step flow. State lives in App.tsx, passed via props. ffmpeg.wasm handles video decoding; Canvas API (offscreen) handles image scaling and dithering; pure functions generate the OLED byte format and C output.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS, @ffmpeg/ffmpeg (WASM), Vitest (tests)

---

## File Structure

```
src/
├── main.tsx                  # React entry
├── App.tsx                   # Root: step state machine, shared state
├── index.css                 # Tailwind + custom styles
├── types.ts                  # Shared interfaces
├── lib/
│   ├── ffmpeg.ts             # ffmpeg.wasm load, metadata, frame extraction
│   ├── dither.ts             # Grayscale, scaling, dither algorithms, OLED packing
│   └── oled-export.ts        # Convert frames[] → C .h file string
└── components/
    ├── VideoUploader.tsx      # Step 1: file drop/select, show metadata
    ├── FrameConfig.tsx        # Step 2: fps slider, frame count, capacity warning
    ├── DitherPreview.tsx      # Step 3: 3-column algorithm comparison
    └── ExportPanel.tsx        # Step 4: download button
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `src/main.tsx`, `src/index.css`

- [ ] **Step 1: Initialize Vite + React + TypeScript project**

```bash
cd C:/Users/12767/Desktop/V-o/Bulid
npm create vite@latest . -- --template react-ts
```

- [ ] **Step 2: Install dependencies**

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util tailwindcss @tailwindcss/vite
```

- [ ] **Step 3: Write vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg'] },
  server: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin',
                       'Cross-Origin-Embedder-Policy': 'require-corp' } }
})
```

- [ ] **Step 4: Write index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Video → OLED 帧切取工具</title>
</head>
<body class="bg-zinc-950 text-zinc-100 min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Write src/index.css**

```css
@import "tailwindcss";
```

- [ ] **Step 6: Write src/main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

- [ ] **Step 7: Verify scaffold**

```bash
npm run dev
# Should see blank page at localhost:5173, no errors
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite + React + Tailwind project"
```

---

### Task 2: Shared Types

**Files:** Create: `src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts && git commit -m "feat: add shared types"
```

---

### Task 3: ffmpeg.wasm Wrapper

**Files:** Create: `src/lib/ffmpeg.ts`

- [ ] **Step 1: Write ffmpeg.ts**

```typescript
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { VideoInfo } from '../types'

let ffmpeg: FFmpeg | null = null

/** Load ffmpeg.wasm (call once) */
export async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg

  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
  const instance = new FFmpeg()
  instance.on('log', ({ message }) => console.log('[ffmpeg]', message))

  await instance.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  ffmpeg = instance
  return ffmpeg
}

/** Extract video metadata */
export async function getVideoInfo(file: File): Promise<VideoInfo> {
  const fm = await loadFFmpeg()
  const inputName = 'input' + getExt(file.name)

  await fm.writeFile(inputName, await fetchFile(file))
  await fm.exec(['-i', inputName, '-f', 'null', '-'])

  // Parse stderr for duration and resolution
  const logs: string[] = []
  fm.on('log', ({ message }) => logs.push(message))

  // Re-run to capture log output
  await fm.exec(['-i', inputName, '-f', 'null', '-'])

  const logText = logs.join('\n')
  const durMatch = logText.match(/Duration: (\d+):(\d+):(\d+)\.(\d+)/)
  let duration = 0
  if (durMatch) {
    duration = +durMatch[1] * 3600 + +durMatch[2] * 60 + +durMatch[3] + +durMatch[4] / 100
  }

  const resMatch = logText.match(/(\d{2,4})x(\d{2,4})/)
  const width = resMatch ? +resMatch[1] : 0
  const height = resMatch ? +resMatch[2] : 0

  await fm.deleteFile(inputName)
  return { duration, width, height, name: file.name }
}

/** Extract a single frame at given timestamp (seconds) as RGB24 raw bytes */
export async function extractRawFrame(
  file: File,
  timestampSec: number,
  outW = 128,
  outH = 64
): Promise<Uint8Array> {
  const fm = await loadFFmpeg()
  const inputName = 'v' + Date.now() + getExt(file.name)

  await fm.writeFile(inputName, await fetchFile(file))
  await fm.exec([
    '-ss', timestampSec.toFixed(3),
    '-i', inputName,
    '-vframes', '1',
    '-s', `${outW}x${outH}`,
    '-pix_fmt', 'gray',
    '-f', 'rawvideo',
    'out.raw'
  ])

  const data = await fm.readFile('out.raw')
  await fm.deleteFile(inputName)
  await fm.deleteFile('out.raw')

  return data as Uint8Array  // 128*64 = 8192 bytes of grayscale
}

/** Extract all frames at regular intervals given fps */
export async function extractAllFrames(
  file: File,
  fps: number,
  outW = 128,
  outH = 64,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array[]> {
  const info = await getVideoInfo(file)
  const totalFrames = Math.floor(info.duration * fps)
  const frames: Uint8Array[] = []

  for (let i = 0; i < totalFrames; i++) {
    const ts = i / fps
    const raw = await extractRawFrame(file, ts, outW, outH)
    frames.push(raw)
    onProgress?.(i + 1, totalFrames)
  }

  return frames
}

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i) : '.mp4'
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ffmpeg.ts && git commit -m "feat: add ffmpeg.wasm wrapper"
```

---

### Task 4: Dithering Algorithms & OLED Packing

**Files:** Create: `src/lib/dither.ts`

- [ ] **Step 1: Write dither.ts**

```typescript
import type { DitherAlgorithm, OLEDFrame } from '../types'

/**
 * Apply simple threshold to grayscale data.
 * pixel > 127 → 1 (white on OLED), <= 127 → 0 (black)
 */
export function threshold(data: Uint8Array): Uint8Array {
  const bin = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    bin[i] = data[i] > 127 ? 1 : 0
  }
  return bin
}

/**
 * Floyd-Steinberg error diffusion dithering.
 * Processes grayscale 128×64, returns binary (0/1) of same dimensions.
 */
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

/**
 * Atkinson dithering — spreads 1/8 error to 6 neighbors.
 */
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

/**
 * Pack binary data (0/1 per pixel, 128×64) into SSD1306 page-column format.
 *
 * SSD1306 layout: 8 pages × 128 columns = 1024 bytes.
 * Each byte represents 8 vertical pixels, LSB = top pixel.
 * Page 0 = rows 0-7, Page 1 = rows 8-15, ..., Page 7 = rows 56-63.
 */
export function packOLED(binary: Uint8Array, width = 128, height = 64): OLEDFrame {
  const pages = height / 8  // 8
  const frame = new Uint8Array(width * pages)  // 1024

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
  height = 64
): Uint8Array {
  switch (algorithm) {
    case 'threshold':       return threshold(data)
    case 'floyd-steinberg': return floydSteinberg(data, width, height)
    case 'atkinson':        return atkinson(data, width, height)
  }
}

/** Full pipeline: raw grayscale → dither → OLED packed bytes */
export function processFrame(
  grayData: Uint8Array,
  algorithm: DitherAlgorithm,
  width = 128,
  height = 64
): OLEDFrame {
  const binary = applyDither(grayData, algorithm, width, height)
  return packOLED(binary, width, height)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/dither.ts && git commit -m "feat: add dithering algorithms and OLED packing"
```

---

### Task 5: OLED Export Module

**Files:** Create: `src/lib/oled-export.ts`

- [ ] **Step 1: Write oled-export.ts**

```typescript
import type { OLEDFrame } from '../types'

/**
 * Format a single byte as 0xNN hex string matching project Diode[] style.
 * Uses uppercase A-F, e.g. 0xFF, 0x01
 * Actually, looking at Diode[]: uses 0xFF,0x01 — lowercase 'x', uppercase hex digits.
 * Let's match exactly: 0xFF format.
 */
function hexByte(b: number): string {
  return '0x' + b.toString(16).toUpperCase().padStart(2, '0')
}

/**
 * Generate the complete video_frames.h file content.
 * Matches the project's OLED_Data.c Diode[] style:
 * - const uint8_t name[size] = { ... };
 * - 16 hex bytes per line
 * - 0xFF format (lowercase x, uppercase hex)
 */
export function generateVideoHeader(
  frames: OLEDFrame[],
  fps: number
): string {
  const frameCount = frames.length
  const lines: string[] = []

  lines.push('#ifndef __VIDEO_FRAMES_H')
  lines.push('#define __VIDEO_FRAMES_H')
  lines.push('')
  lines.push('#include <stdint.h>')
  lines.push('')
  lines.push(`/* Auto-generated video frames for SSD1306 OLED (128x64)`)
  lines.push(`   Frames: ${frameCount}, FPS: ${fps}`)
  lines.push(`   Total: ${frameCount * 1024} bytes (${(frameCount * 1024 / 1024).toFixed(1)} KB)`)
  lines.push(`*/`)
  lines.push('')
  lines.push(`#define VIDEO_FRAME_COUNT ${frameCount}`)
  lines.push(`#define VIDEO_FPS ${fps}`)
  lines.push('')

  for (let f = 0; f < frameCount; f++) {
    const name = `video_frame_${String(f).padStart(3, '0')}`
    const data = frames[f]
    lines.push(`const uint8_t ${name}[1024] = {`)

    // 16 bytes per line, matching Diode[] style
    for (let i = 0; i < 1024; i += 16) {
      const row = []
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/oled-export.ts && git commit -m "feat: add OLED C header export module"
```

---

### Task 6: VideoUploader Component (Step 1)

**Files:** Create: `src/components/VideoUploader.tsx`

- [ ] **Step 1: Write VideoUploader.tsx**

```typescript
import { useCallback, useRef, useState } from 'react'
import type { VideoInfo } from '../types'
import { getVideoInfo, loadFFmpeg } from '../lib/ffmpeg'

interface Props {
  onVideoReady: (file: File, info: VideoInfo) => void
}

export default function VideoUploader({ onVideoReady }: Props) {
  const [dragOver, setDragOver] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const preloadFFmpeg = useCallback(async () => {
    if (ffmpegLoaded) return
    setLoading(true)
    try {
      await loadFFmpeg()
      setFfmpegLoaded(true)
    } catch {
      setError('ffmpeg.wasm 加载失败，请检查网络')
    } finally {
      setLoading(false)
    }
  }, [ffmpegLoaded])

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('video/')) {
      setError('请上传视频文件')
      return
    }
    setError('')
    setLoading(true)
    try {
      const info = await getVideoInfo(file)
      onVideoReady(file, info)
    } catch {
      setError('视频解析失败，请检查文件格式')
    } finally {
      setLoading(false)
    }
  }, [onVideoReady])

  return (
    <div className="max-w-xl mx-auto text-center">
      <h2 className="text-xl font-bold mb-2">Step 1: 上传视频</h2>
      <p className="text-zinc-400 text-sm mb-4">
        {!ffmpegLoaded && '首次使用需下载 ffmpeg.wasm (~30MB)，'}
        支持 mp4/mov/avi/webm
      </p>

      {!ffmpegLoaded && (
        <button
          onClick={preloadFFmpeg}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? '加载 ffmpeg.wasm 中...' : '🔧 初始化引擎'}
        </button>
      )}

      {ffmpegLoaded && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); processFile(e.dataTransfer.files[0]!) }}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-12 cursor-pointer transition
            ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-zinc-600 hover:border-zinc-400'}`}
        >
          <div className="text-4xl mb-3">📹</div>
          <p className="text-zinc-300">拖拽视频到此处，或点击选择</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
          />
        </div>
      )}

      {loading && ffmpegLoaded && (
        <p className="mt-3 text-zinc-400 animate-pulse">解析视频中...</p>
      )}
      {error && <p className="mt-3 text-red-400">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/VideoUploader.tsx && git commit -m "feat: add VideoUploader component"
```

---

### Task 7: FrameConfig Component (Step 2)

**Files:** Create: `src/components/FrameConfig.tsx`

- [ ] **Step 1: Write FrameConfig.tsx**

```typescript
import type { VideoInfo, DitherAlgorithm } from '../types'
import { DITHER_OPTIONS } from '../types'

interface Props {
  videoInfo: VideoInfo
  fps: number
  onFpsChange: (fps: number) => void
  algorithm: DitherAlgorithm
  onAlgorithmChange: (alg: DitherAlgorithm) => void
  onProcess: () => void
  processing: boolean
}

const STM32_FLASH_KB = 60 // typical available flash for F103C8

export default function FrameConfig({
  videoInfo, fps, onFpsChange, algorithm, onAlgorithmChange, onProcess, processing
}: Props) {
  const frameCount = Math.floor(videoInfo.duration * fps)
  const totalKB = frameCount * 1024 / 1024
  const overBudget = totalKB > STM32_FLASH_KB

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-xl font-bold mb-2">Step 2: 切帧配置</h2>
      <p className="text-zinc-400 text-sm mb-6">
        视频: <span className="text-zinc-200">{videoInfo.name}</span>
        {' · '}{videoInfo.duration.toFixed(1)}s · {videoInfo.width}×{videoInfo.height}
      </p>

      {/* FPS slider */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">
          帧率: <span className="text-blue-400 font-bold">{fps} fps</span>
        </label>
        <input
          type="range" min={1} max={30} value={fps}
          onChange={(e) => onFpsChange(+e.target.value)}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-zinc-500 mt-1">
          <span>1 fps</span><span>30 fps</span>
        </div>
      </div>

      {/* Budget display */}
      <div className={`rounded-lg p-4 mb-6 ${overBudget ? 'bg-red-500/10 border border-red-500/30' : 'bg-zinc-800'}`}>
        <div className="flex justify-between text-sm">
          <span>预计帧数</span>
          <span className="font-mono">{frameCount} 帧</span>
        </div>
        <div className="flex justify-between text-sm mt-1">
          <span>占用空间</span>
          <span className={`font-mono ${overBudget ? 'text-red-400' : ''}`}>
            {totalKB.toFixed(1)} KB
            {overBudget && ` ⚠️ 超出 Flash (${STM32_FLASH_KB}KB)`}
          </span>
        </div>
      </div>

      {/* Algorithm selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">二值化算法</label>
        <div className="flex gap-2">
          {DITHER_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onAlgorithmChange(key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition
                ${algorithm === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Process button */}
      <button
        onClick={onProcess}
        disabled={processing}
        className="w-full py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg
                   disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {processing ? '⏳ 处理中...' : '🎬 开始切帧'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FrameConfig.tsx && git commit -m "feat: add FrameConfig component"
```

---

### Task 8: DitherPreview Component (Step 3)

**Files:** Create: `src/components/DitherPreview.tsx`

- [ ] **Step 1: Write DitherPreview.tsx**

```typescript
import { useEffect, useRef } from 'react'
import type { DitherAlgorithm } from '../types'
import { DITHER_OPTIONS } from '../types'
import { applyDither } from '../lib/dither'

interface Props {
  sampleGray: Uint8Array | null   // 128×64 raw grayscale
  selected: DitherAlgorithm
  onSelect: (alg: DitherAlgorithm) => void
}

function renderToCanvas(
  canvas: HTMLCanvasElement,
  binary: Uint8Array,
  width = 128,
  height = 64,
  scale = 4
) {
  const ctx = canvas.getContext('2d')!
  canvas.width = width * scale
  canvas.height = height * scale
  const img = ctx.createImageData(width, height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const v = binary[idx] ? 255 : 0
      const p = (y * width + x) * 4
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = 255
    }
  }

  // Scale up with crisp pixels (no smoothing)
  const offCanvas = document.createElement('canvas')
  offCanvas.width = width
  offCanvas.height = height
  offCanvas.getContext('2d')!.putImageData(img, 0, 0)

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height)
}

export default function DitherPreview({ sampleGray, selected, onSelect }: Props) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())

  useEffect(() => {
    if (!sampleGray) return
    for (const { key } of DITHER_OPTIONS) {
      const canvas = canvasRefs.current.get(key)
      if (!canvas) continue
      const binary = applyDither(sampleGray, key)
      renderToCanvas(canvas, binary)
    }
  }, [sampleGray])

  if (!sampleGray) return null

  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-2">Step 3: 对比预览 & 选择算法</h2>
      <p className="text-zinc-400 text-sm mb-4">取中间帧预览，点击选择最终算法（放大 4 倍显示）</p>

      <div className="grid grid-cols-3 gap-4">
        {DITHER_OPTIONS.map(({ key, label }) => (
          <div
            key={key}
            onClick={() => onSelect(key)}
            className={`cursor-pointer rounded-xl p-4 transition border-2
              ${selected === key
                ? 'border-blue-400 bg-blue-500/5'
                : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900'}`}
          >
            <h3 className="text-center font-medium mb-3">{label}</h3>
            <canvas
              ref={(el) => { if (el) canvasRefs.current.set(key, el) }}
              className="w-full bg-black rounded-lg"
            />
            {selected === key && (
              <p className="text-center text-blue-400 text-sm mt-2">✓ 已选择</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/DitherPreview.tsx && git commit -m "feat: add DitherPreview component"
```

---

### Task 9: ExportPanel Component (Step 4)

**Files:** Create: `src/components/ExportPanel.tsx`

- [ ] **Step 1: Write ExportPanel.tsx**

```typescript
import { useState } from 'react'
import type { OLEDFrame, DitherAlgorithm } from '../types'
import { downloadHeader } from '../lib/oled-export'

interface Props {
  frames: OLEDFrame[]
  fps: number
  algorithm: DitherAlgorithm
  onReset: () => void
}

export default function ExportPanel({ frames, fps, algorithm, onReset }: Props) {
  const [downloaded, setDownloaded] = useState(false)

  const handleDownload = () => {
    downloadHeader(frames, fps)
    setDownloaded(true)
  }

  const totalKB = (frames.length * 1024 / 1024).toFixed(1)

  return (
    <div className="max-w-xl mx-auto text-center">
      <h2 className="text-xl font-bold mb-2">Step 4: 导出</h2>
      <p className="text-zinc-400 text-sm mb-6">
        {frames.length} 帧 · {totalKB} KB · {algorithm}
      </p>

      <div className="bg-zinc-800 rounded-lg p-6 mb-6 text-left">
        <p className="text-sm text-zinc-400 mb-2">生成的文件: <code className="text-green-400">video_frames.h</code></p>
        <pre className="text-xs text-zinc-300 overflow-x-auto">
{`#ifndef __VIDEO_FRAMES_H
#define __VIDEO_FRAMES_H
#include <stdint.h>
#define VIDEO_FRAME_COUNT ${frames.length}
#define VIDEO_FPS ${fps}

const uint8_t video_frame_000[1024] = { ... };
// ... 共 ${frames.length} 帧
#endif`}
        </pre>
      </div>

      <div className="flex gap-3 justify-center">
        <button
          onClick={handleDownload}
          disabled={downloaded}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold
                     disabled:opacity-50 transition"
        >
          {downloaded ? '✅ 已下载' : '📥 下载 video_frames.h'}
        </button>
        <button
          onClick={onReset}
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition"
        >
          🔄 重新开始
        </button>
      </div>

      <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg text-left text-xs text-zinc-400">
        <p className="font-medium text-zinc-300 mb-1">STM32 播放代码参考:</p>
        <pre className="overflow-x-auto">
{`#include "video_frames.h"
// 逐帧播放
for (int f = 0; f < VIDEO_FRAME_COUNT; f++) {
    OLED_ShowImage(0, 0, 128, 64, video_frames[f]);
    OLED_Update();
    Delay_ms(1000 / VIDEO_FPS);
}`}
        </pre>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ExportPanel.tsx && git commit -m "feat: add ExportPanel component"
```

---

### Task 10: App.tsx — Wire Everything Together

**Files:** Create: `src/App.tsx`

- [ ] **Step 1: Write App.tsx**

```typescript
import { useCallback, useState } from 'react'
import type { VideoInfo, OLEDFrame, DitherAlgorithm, AppStep } from './types'
import VideoUploader from './components/VideoUploader'
import FrameConfig from './components/FrameConfig'
import DitherPreview from './components/DitherPreview'
import ExportPanel from './components/ExportPanel'
import { extractRawFrame, extractAllFrames } from './lib/ffmpeg'
import { processFrame } from './lib/dither'

export default function App() {
  const [step, setStep] = useState<AppStep>(1)
  const [file, setFile] = useState<File | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [fps, setFps] = useState(10)
  const [algorithm, setAlgorithm] = useState<DitherAlgorithm>('floyd-steinberg')
  const [sampleGray, setSampleGray] = useState<Uint8Array | null>(null)
  const [frames, setFrames] = useState<OLEDFrame[]>([])
  const [processing, setProcessing] = useState(false)

  const handleVideoReady = useCallback(async (f: File, info: VideoInfo) => {
    setFile(f)
    setVideoInfo(info)
    setStep(2)

    // Pre-extract middle frame for preview
    const midTs = info.duration / 2
    const gray = await extractRawFrame(f, midTs, 128, 64)
    setSampleGray(gray)
  }, [])

  const handleProcess = useCallback(async () => {
    if (!file) return
    setProcessing(true)
    try {
      const rawFrames = await extractAllFrames(file, fps, 128, 64, (cur, total) => {
        console.log(`Extracting ${cur}/${total}`)
      })
      const oledFrames = rawFrames.map((raw) => processFrame(raw, algorithm))
      setFrames(oledFrames)
      setStep(4)
    } finally {
      setProcessing(false)
    }
  }, [file, fps, algorithm])

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setVideoInfo(null)
    setSampleGray(null)
    setFrames([])
    setFps(10)
    setAlgorithm('floyd-steinberg')
    setProcessing(false)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 py-4 px-6 mb-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">🎬 Video → OLED 帧切取工具</h1>
            <p className="text-xs text-zinc-500">SSD1306 128×64 单色 OLED</p>
          </div>
          <div className="flex gap-1">
            {([1, 2, 3, 4] as AppStep[]).map((s) => (
              <div key={s} className={`w-8 h-1 rounded-full transition
                ${s <= step ? 'bg-blue-500' : 'bg-zinc-700'}`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="px-6 pb-12">
        {step === 1 && <VideoUploader onVideoReady={handleVideoReady} />}

        {step >= 2 && videoInfo && (
          <FrameConfig
            videoInfo={videoInfo}
            fps={fps}
            onFpsChange={setFps}
            algorithm={algorithm}
            onAlgorithmChange={setAlgorithm}
            onProcess={handleProcess}
            processing={processing}
          />
        )}

        {step >= 2 && sampleGray && step === 3 && (
          <div className="mt-10">
            <DitherPreview
              sampleGray={sampleGray}
              selected={algorithm}
              onSelect={setAlgorithm}
            />
          </div>
        )}

        {step === 4 && (
          <ExportPanel
            frames={frames}
            fps={fps}
            algorithm={algorithm}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 2: Verify everything compiles**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx && git commit -m "feat: wire all components in App.tsx"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Start dev server and test manually**

```bash
npm run dev
```

Manual checklist:
1. [ ] Open `http://localhost:5173` — see Step 1
2. [ ] Click "初始化引擎" — ffmpeg.wasm loads
3. [ ] Upload a short mp4 video — see Step 2 with correct duration/resolution
4. [ ] Adjust fps slider — frame count and KB update in real time
5. [ ] Switch dither algorithm buttons
6. [ ] Click "开始切帧" — frames process, progress logged
7. [ ] Arrive at Step 4 Export page
8. [ ] Click "下载 video_frames.h" — file downloads
9. [ ] Open downloaded .h — verify format matches Diode[] style:
   - `0x` lowercase-x, uppercase hex
   - 16 bytes per line
   - `const uint8_t video_frame_XXX[1024] = { ... };`
   - Correct `#ifndef` guard
10. [ ] Click "重新开始" — returns to Step 1

- [ ] **Step 2: Fix any issues found**

- [ ] **Step 3: Final commit**

```bash
git add -A && git commit -m "chore: finalize and verify"
```
