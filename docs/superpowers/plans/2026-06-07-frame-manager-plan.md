# 帧管理功能 - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Insert a FrameManager step between algorithm preview and export, allowing users to preview every frame, toggle keep/exclude per frame, and export only retained frames.

**Architecture:** Extend AppStep from 4 to 5 steps. Extract all frames once, store raw grayscale in App.tsx, share across Step 3/4/5. New FrameManager component with filmstrip + large preview. Existing components receive minimal prop changes.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, Canvas API

---

## File Structure

```
src/
├── types.ts                     # Modify: AppStep 1|2|3|4 → 1|2|3|4|5
├── App.tsx                      # Modify: new states, step routing, callbacks
├── components/
│   ├── FrameConfig.tsx           # Modify: no prop changes (parent handles routing)
│   ├── DitherPreview.tsx         # Modify: add onNext prop + button
│   ├── FrameManager.tsx          # Create: frame preview + filmstrip + toggle
│   └── ExportPanel.tsx           # Modify: receive rawFrames + excludedFrames
```

---

### Task 1: Update types.ts — Extend AppStep

**Files:** Modify: `src/types.ts`

- [ ] **Step 1: Change AppStep from 4 to 5 steps**

```typescript
/** App state machine steps */
export type AppStep = 1 | 2 | 3 | 4 | 5
```

- [ ] **Step 2: Verify no TypeScript errors from the change alone**

```bash
npx tsc --noEmit
```
Expected: errors in App.tsx only (step routing not yet updated), types.ts clean.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts && git commit -m "feat: extend AppStep to 5 steps for frame manager"
```

---

### Task 2: Update FrameConfig — No UI changes

**Files:** Modify: `src/components/FrameConfig.tsx`

FrameConfig itself does NOT change — its "开始切帧" button still calls `onProcess`. The parent (App.tsx) will change where that leads. No code edits needed in this file.

**Skip this task** — component is unchanged.

---

### Task 3: Update DitherPreview — Add "next" button

**Files:** Modify: `src/components/DitherPreview.tsx`

- [ ] **Step 1: Add `onNext` prop to Props interface**

```typescript
interface Props {
  sampleGray: Uint8Array | null
  selected: DitherAlgorithm
  onSelect: (alg: DitherAlgorithm) => void
  onNext: () => void            // ← new
}
```

- [ ] **Step 2: Add "下一步" button below the 3-column grid**

After the closing `</div>` of the grid (line ~85), add:

```typescript
      <div className="mt-8 text-center">
        <button
          onClick={onNext}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg transition"
        >
          下一步：帧管理 →
        </button>
      </div>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/DitherPreview.tsx && git commit -m "feat: add next button to DitherPreview for frame manager navigation"
```

---

### Task 4: Create FrameManager Component

**Files:** Create: `src/components/FrameManager.tsx`

This is the main new component. Build in several sub-steps.

- [ ] **Step 1: Create the file with imports, types, and props**

```typescript
import { useEffect, useRef, useCallback } from 'react'
import type { DitherAlgorithm } from '../types'
import { processFrame } from '../lib/dither'

interface Props {
  rawFrames: Uint8Array[]
  algorithm: DitherAlgorithm
  excludedFrames: Set<number>
  onToggleFrame: (index: number) => void
  selectedFrameIndex: number
  onSelectFrame: (index: number) => void
  onBack: () => void
  onNext: () => void
}

export default function FrameManager({
  rawFrames, algorithm, excludedFrames,
  onToggleFrame, selectedFrameIndex, onSelectFrame,
  onBack, onNext
}: Props) {
  // ... implementation in following steps
}
```

- [ ] **Step 2: Add thumbnail rendering helper (outside component)**

```typescript
/** Render a single frame to a 256×128 (2x) canvas for the filmstrip */
function renderThumbnail(
  canvas: HTMLCanvasElement,
  rawData: Uint8Array,
  algorithm: DitherAlgorithm,
  excluded: boolean
) {
  const oled = processFrame(rawData, algorithm)
  const width = 128, height = 64, scale = 2
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')!

  const img = ctx.createImageData(width, height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const byteIdx = Math.floor(y / 8) * width + x
      const bit = y % 8
      const pixelOn = (oled[byteIdx] >> bit) & 1
      const v = pixelOn ? 255 : 0
      const p = (y * width + x) * 4
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = 255
    }
  }

  const offCanvas = document.createElement('canvas')
  offCanvas.width = width
  offCanvas.height = height
  offCanvas.getContext('2d')!.putImageData(img, 0, 0)

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#18181b' // zinc-900
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = excluded ? 0.35 : 1.0
  ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = 1.0

  // Red border for excluded frames
  if (excluded) {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
  }
}
```

- [ ] **Step 3: Add large preview rendering helper (outside component)**

```typescript
/** Render selected frame at large scale to canvas, preserving 2:1 aspect ratio */
function renderLargePreview(
  canvas: HTMLCanvasElement,
  rawData: Uint8Array,
  algorithm: DitherAlgorithm,
  containerWidth: number,
  containerHeight: number
) {
  const oled = processFrame(rawData, algorithm)
  const srcW = 128, srcH = 64

  // Calculate scale to fit container while preserving 2:1 ratio
  const scaleByWidth = Math.floor(containerWidth / srcW)
  const scaleByHeight = Math.floor(containerHeight / srcH)
  const scale = Math.max(1, Math.min(scaleByWidth, scaleByHeight))

  const outW = srcW * scale
  const outH = srcH * scale
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')!

  const img = ctx.createImageData(srcW, srcH)
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const byteIdx = Math.floor(y / 8) * srcW + x
      const bit = y % 8
      const pixelOn = (oled[byteIdx] >> bit) & 1
      const v = pixelOn ? 255 : 0
      const p = (y * srcW + x) * 4
      img.data[p] = v
      img.data[p + 1] = v
      img.data[p + 2] = v
      img.data[p + 3] = 255
    }
  }

  const offCanvas = document.createElement('canvas')
  offCanvas.width = srcW
  offCanvas.height = srcH
  offCanvas.getContext('2d')!.putImageData(img, 0, 0)

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(offCanvas, 0, 0, outW, outH)
}
```

- [ ] **Step 4: Implement component body — refs, keyboard, filmstrip scroll**

```typescript
export default function FrameManager({
  rawFrames, algorithm, excludedFrames,
  onToggleFrame, selectedFrameIndex, onSelectFrame,
  onBack, onNext
}: Props) {
  const largeCanvasRef = useRef<HTMLCanvasElement>(null)
  const largeContainerRef = useRef<HTMLDivElement>(null)
  const filmstripRef = useRef<HTMLDivElement>(null)
  const thumbCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map())
  const selectedThumbRef = useRef<HTMLDivElement>(null)

  const frameCount = rawFrames.length
  const keptCount = frameCount - excludedFrames.size
  const totalKB = frameCount * 1024 / 1024
  const keptKB = keptCount * 1024 / 1024
  const allExcluded = keptCount === 0

  // Render thumbnails when rawFrames or algorithm changes
  useEffect(() => {
    for (let i = 0; i < rawFrames.length; i++) {
      const canvas = thumbCanvasRefs.current.get(i)
      if (!canvas) continue
      renderThumbnail(canvas, rawFrames[i], algorithm, excludedFrames.has(i))
    }
  }, [rawFrames, algorithm, excludedFrames])

  // Render large preview when selected frame changes
  useEffect(() => {
    const canvas = largeCanvasRef.current
    const container = largeContainerRef.current
    if (!canvas || !container || !rawFrames[selectedFrameIndex]) return
    const rect = container.getBoundingClientRect()
    renderLargePreview(canvas, rawFrames[selectedFrameIndex], algorithm, rect.width, rect.height)
  }, [rawFrames, algorithm, selectedFrameIndex])

  // Scroll selected thumbnail into view
  useEffect(() => {
    selectedThumbRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [selectedFrameIndex])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' && selectedFrameIndex > 0) {
      onSelectFrame(selectedFrameIndex - 1)
    } else if (e.key === 'ArrowRight' && selectedFrameIndex < frameCount - 1) {
      onSelectFrame(selectedFrameIndex + 1)
    } else if (e.key === ' ') {
      e.preventDefault()
      onToggleFrame(selectedFrameIndex)
    }
  }, [selectedFrameIndex, frameCount, onSelectFrame, onToggleFrame])

  // Mouse wheel → horizontal scroll
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (filmstripRef.current) {
      filmstripRef.current.scrollLeft += e.deltaY
    }
  }, [])
```

- [ ] **Step 5: Implement JSX return**

```typescript
  return (
    <div className="max-w-5xl mx-auto" onKeyDown={handleKeyDown} tabIndex={0} ref={(el) => el?.focus()}>
      <h2 className="text-xl font-bold mb-1">Step 4: 帧管理</h2>
      <p className="text-zinc-400 text-sm mb-4">
        预览每一帧，按 <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-xs">Space</kbd> 切换保留/排除
        · <kbd className="px-1 py-0.5 bg-zinc-700 rounded text-xs">← →</kbd> 切换帧
      </p>

      {/* Stats bar */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-zinc-400">
          保留 <span className="text-green-400 font-mono font-bold">{keptCount}</span>
          {' / '}{frameCount} 帧
        </span>
        <span className="text-zinc-500">·</span>
        <span className={`font-mono ${keptKB > 60 ? 'text-red-400' : 'text-zinc-400'}`}>
          {keptKB.toFixed(1)} KB
          {keptKB > 60 && ` ⚠️ 超出 Flash (60KB)`}
        </span>
        {excludedFrames.size > 0 && (
          <>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-500">{excludedFrames.size} 帧已排除</span>
          </>
        )}
      </div>

      {/* Large preview */}
      <div
        ref={largeContainerRef}
        className="bg-black rounded-xl mb-4 flex items-center justify-center overflow-hidden"
        style={{ minHeight: 320 }}
      >
        <canvas ref={largeCanvasRef} className="block" />
      </div>

      {/* Frame info */}
      <p className="text-center text-sm text-zinc-400 mb-4">
        帧 #{selectedFrameIndex + 1} · {(selectedFrameIndex / Math.max(1, frameCount - 1) * 10).toFixed(0)}s
        {excludedFrames.has(selectedFrameIndex)
          ? <span className="text-red-400 ml-2">✕ 已排除</span>
          : <span className="text-green-400 ml-2">✓ 保留</span>}
      </p>

      {/* Filmstrip */}
      <div
        ref={filmstripRef}
        onWheel={handleWheel}
        className="flex gap-2 overflow-x-auto pb-3 cursor-grab active:cursor-grabbing"
        style={{ scrollBehavior: 'smooth' }}
      >
        {rawFrames.map((_, i) => {
          const excluded = excludedFrames.has(i)
          const selected = i === selectedFrameIndex
          return (
            <div
              key={i}
              ref={selected ? selectedThumbRef : undefined}
              onClick={() => onSelectFrame(i)}
              onDoubleClick={() => onToggleFrame(i)}
              className={`flex-shrink-0 rounded-lg overflow-hidden border-2 transition cursor-pointer
                ${selected ? 'border-blue-400' : excluded ? 'border-red-500/70' : 'border-zinc-700 hover:border-zinc-500'}`}
            >
              <canvas
                ref={(el) => { if (el) thumbCanvasRefs.current.set(i, el) }}
                className="block"
                style={{ width: 256, height: 128 }}
              />
              <div className={`text-center text-[10px] py-0.5 ${excluded ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'}`}>
                {excluded ? '✕' : '✓'} #{i + 1}
              </div>
            </div>
          )
        })}
      </div>

      {/* Action buttons */}
      <div className="flex justify-between mt-6">
        <button
          onClick={onBack}
          className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg font-medium transition"
        >
          ← 返回算法
        </button>
        <button
          onClick={onNext}
          disabled={allExcluded}
          className="px-8 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold text-lg transition
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          下一步：导出 →
        </button>
      </div>

      {allExcluded && (
        <p className="text-center text-red-400 text-sm mt-2">请至少保留一帧</p>
      )}
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/FrameManager.tsx && git commit -m "feat: add FrameManager component with filmstrip and large preview"
```

---

### Task 5: Update App.tsx — Wire new states and step routing

**Files:** Modify: `src/App.tsx`

- [ ] **Step 1: Import FrameManager**

Add import at top:
```typescript
import FrameManager from './components/FrameManager'
```

- [ ] **Step 2: Add new state variables**

After `const [processing, setProcessing] = useState(false)`:

```typescript
const [rawFrames, setRawFrames] = useState<Uint8Array[]>([])
const [excludedFrames, setExcludedFrames] = useState<Set<number>>(new Set())
const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)
```

- [ ] **Step 3: Rewrite handleProcess — extract all frames, go to Step 3**

Replace the existing `handleProcess`:

```typescript
const handleProcess = useCallback(async () => {
  if (!file) return
  setProcessing(true)
  try {
    const raw = await extractAllFrames(file, fps, 128, 64, fitMode, invert, (cur, total) => {
      console.log(`Extracting ${cur}/${total}`)
    })
    setRawFrames(raw)
    setExcludedFrames(new Set())
    setSelectedFrameIndex(0)
    setStep(3)
  } finally {
    setProcessing(false)
  }
}, [file, fps, fitMode, invert])
```

- [ ] **Step 4: Add new navigation callbacks**

```typescript
const handleGoFrameManager = useCallback(() => {
  setSelectedFrameIndex(0)
  setStep(4)
}, [])

const handleBackToAlgorithm = useCallback(() => {
  setExcludedFrames(new Set())
  setSelectedFrameIndex(0)
  setStep(3)
}, [])

const handleGoExport = useCallback(() => {
  setStep(5)
}, [])
```

- [ ] **Step 5: Update handleReset — clear new states**

Replace existing `handleReset`:

```typescript
const handleReset = () => {
  setStep(1)
  setFile(null)
  setVideoInfo(null)
  setSampleGray(null)
  setFrames([])
  setRawFrames([])
  setExcludedFrames(new Set())
  setSelectedFrameIndex(0)
  setFps(10)
  setAlgorithm('floyd-steinberg')
  setFitMode('letterbox')
  setInvert(false)
  setProcessing(false)
}
```

- [ ] **Step 6: Update handleVideoReady — pass fitMode and invert to extractRawFrame**

The `handleVideoReady` callback currently calls `extractRawFrame(f, midTs, 128, 64)` without `fitMode` and `invert`. Update it:

```typescript
const gray = await extractRawFrame(f, midTs, 128, 64, fitMode, invert)
```

- [ ] **Step 7: Rewrite JSX step routing**

Replace the `<main>` content:

```typescript
<main className="px-6 pb-12">
  {step === 1 && <VideoUploader onVideoReady={handleVideoReady} />}

  {step >= 2 && videoInfo && (
    <FrameConfig
      videoInfo={videoInfo}
      fps={fps}
      onFpsChange={setFps}
      algorithm={algorithm}
      onAlgorithmChange={setAlgorithm}
      fitMode={fitMode}
      onFitModeChange={setFitMode}
      invert={invert}
      onInvertChange={setInvert}
      onProcess={handleProcess}
      processing={processing}
    />
  )}

  {step === 3 && sampleGray && (
    <div className="mt-10">
      <DitherPreview
        sampleGray={sampleGray}
        selected={algorithm}
        onSelect={setAlgorithm}
        onNext={handleGoFrameManager}
      />
    </div>
  )}

  {step === 4 && rawFrames.length > 0 && (
    <div className="mt-10">
      <FrameManager
        rawFrames={rawFrames}
        algorithm={algorithm}
        excludedFrames={excludedFrames}
        onToggleFrame={(i) => {
          setExcludedFrames(prev => {
            const next = new Set(prev)
            if (next.has(i)) next.delete(i)
            else next.add(i)
            return next
          })
        }}
        selectedFrameIndex={selectedFrameIndex}
        onSelectFrame={setSelectedFrameIndex}
        onBack={handleBackToAlgorithm}
        onNext={handleGoExport}
      />
    </div>
  )}

  {step === 5 && rawFrames.length > 0 && (
    <ExportPanel
      rawFrames={rawFrames}
      excludedFrames={excludedFrames}
      fps={fps}
      algorithm={algorithm}
      onReset={handleReset}
    />
  )}
</main>
```

Note: Remove the old `step === 4` ExportPanel block. Remove the old `frames` state usage from handleProcess (no longer setting `setFrames`). The `frames` state variable can be kept for backward compatibility but is no longer used.

- [ ] **Step 8: Fix handleVideoReady — pass fitMode and invert to extractRawFrame**

The existing `handleVideoReady` calls `extractRawFrame(f, midTs, 128, 64)` without `fitMode` and `invert`. Add them:

```typescript
const gray = await extractRawFrame(f, midTs, 128, 64, fitMode, invert)
```

The middle-frame sample is primarily for algorithm comparison in Step 3. Minor staleness when fitMode/invert changes is acceptable — the actual extraction in `handleProcess` uses the current values.

- [ ] **Step 9: Verify build**

```bash
npm run build
```

- [ ] **Step 10: Commit**

```bash
git add src/App.tsx && git commit -m "feat: wire FrameManager into 5-step flow in App.tsx"
```

---

### Task 6: Update ExportPanel — Filter excluded frames on export

**Files:** Modify: `src/components/ExportPanel.tsx`

- [ ] **Step 1: Change Props interface**

Replace the Props:

```typescript
import type { DitherAlgorithm } from '../types'
import { processFrame } from '../lib/dither'
import { downloadHeader } from '../lib/oled-export'
import { useEffect, useMemo, useState } from 'react'

interface Props {
  rawFrames: Uint8Array[]
  excludedFrames: Set<number>
  fps: number
  algorithm: DitherAlgorithm
  onReset: () => void
}
```

- [ ] **Step 2: Derive kept frames and OLED data on export**

Replace the component body:

```typescript
export default function ExportPanel({ rawFrames, excludedFrames, fps, algorithm, onReset }: Props) {
  const [downloaded, setDownloaded] = useState(false)

  // Reset download state when rawFrames changes
  useEffect(() => {
    setDownloaded(false)
  }, [rawFrames])

  // Process kept frames on demand (at download time)
  const keptOLEDFrames = useMemo(() => {
    return rawFrames
      .filter((_, i) => !excludedFrames.has(i))
      .map(raw => processFrame(raw, algorithm))
  }, [rawFrames, excludedFrames, algorithm])

  const handleDownload = () => {
    downloadHeader(keptOLEDFrames, fps)
    setDownloaded(true)
  }

  const totalFrames = rawFrames.length
  const keptCount = keptOLEDFrames.length
  const excludedCount = totalFrames - keptCount
  const totalKB = (keptCount * 1024 / 1024).toFixed(1)
```

- [ ] **Step 3: Update JSX — show kept/excluded stats**

Replace the stats line in JSX:

```typescript
      <p className="text-zinc-400 text-sm mb-6">
        {keptCount} 帧 · {totalKB} KB · {algorithm}
        {excludedCount > 0 && (
          <span className="text-zinc-500"> · 已排除 {excludedCount} 帧</span>
        )}
      </p>
```

- [ ] **Step 4: Update the file preview text to show kept count**

```typescript
        <pre className="text-xs text-zinc-300 overflow-x-auto">
{`#ifndef __VIDEO_FRAMES_H
#define __VIDEO_FRAMES_H
#include <stdint.h>
#define VIDEO_FRAME_COUNT ${keptCount}
#define VIDEO_FPS ${fps}

const uint8_t video_frame_000[1024] = { ... };
// ... 共 ${keptCount} 帧（${excludedCount} 帧已排除）
// 指针表，支持 video_frames[f] 索引访问
const uint8_t* video_frames[VIDEO_FRAME_COUNT] = {
    video_frame_000,
    video_frame_001,
    // ...
};
#endif`}
        </pre>
```

- [ ] **Step 5: Verify build**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/components/ExportPanel.tsx && git commit -m "feat: update ExportPanel to filter excluded frames on export"
```

---

### Task 7: End-to-End Verification

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Manual test checklist**

1. [ ] Open `http://localhost:5173` — see Step 1 upload page
2. [ ] Init ffmpeg.wasm engine
3. [ ] Upload a short mp4 — see Step 2 with video info
4. [ ] Adjust fps, fit mode, invert — observe settings update
5. [ ] Click "开始切帧" — progress logged, arrive at Step 3 (algorithm preview)
6. [ ] See 3-column algorithm comparison for middle frame
7. [ ] Click algorithm to switch — previews update
8. [ ] Click "下一步：帧管理" — arrive at Step 4
9. [ ] See all frames in filmstrip, large preview of frame #1
10. [ ] Click thumbnails — large preview updates, selected frame highlighted
11. [ ] Press Space — frame toggles exclude/include, red border + opacity updates
12. [ ] Scroll filmstrip with mouse wheel — horizontal scroll works
13. [ ] Press ← → keys — selection moves, filmstrip scrolls to keep visible
14. [ ] Exclude all frames — "下一步" disabled, warning shown
15. [ ] Click "← 返回算法" — back to Step 3, go forward again, exclusions are cleared
16. [ ] Set some excludes, click "下一步：导出" — arrive at Step 5
17. [ ] See correct kept/excluded count
18. [ ] Click download — .h file downloads
19. [ ] Open .h — verify only kept frames, correct count, pointer table
20. [ ] Click "重新开始" — returns to Step 1, all state reset

- [ ] **Step 3: Fix any issues found, then final commit**

```bash
git add -A && git commit -m "chore: finalize frame manager integration"
```
