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
  ctx.fillStyle = '#18181b'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = excluded ? 0.35 : 1.0
  ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = 1.0

  if (excluded) {
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2)
  }
}

/** Render selected frame at large scale, preserving 2:1 aspect ratio */
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
  const keptKB = keptCount * 1024 / 1024
  const allExcluded = keptCount === 0

  // Render thumbnails when data changes
  useEffect(() => {
    for (let i = 0; i < rawFrames.length; i++) {
      const canvas = thumbCanvasRefs.current.get(i)
      if (!canvas) continue
      renderThumbnail(canvas, rawFrames[i], algorithm, excludedFrames.has(i))
    }
  }, [rawFrames, algorithm, excludedFrames])

  // Render large preview when selection changes
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

  // Auto-focus for keyboard
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    el?.focus()
  }, [])

  // Approximate timestamp for display
  const currentTime = frameCount > 1
    ? (selectedFrameIndex / (frameCount - 1) * (frameCount / 10)).toFixed(1)
    : '0.0'

  return (
    <div className="max-w-5xl mx-auto outline-none" onKeyDown={handleKeyDown} tabIndex={0} ref={containerRef}>
      <h2 className="text-xl font-bold mb-1">Step 4: 帧管理</h2>
      <p className="text-zinc-400 text-sm mb-4">
        预览每一帧，按 <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs font-mono">Space</kbd> 切换保留/排除
        · <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-xs font-mono">← →</kbd> 切换帧
        · 双击缩略图切换排除
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
        帧 #{selectedFrameIndex + 1} · {currentTime}s
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
              <div className={`text-center text-[10px] py-0.5 font-mono ${
                excluded ? 'bg-red-500/20 text-red-400' : 'bg-zinc-800 text-zinc-400'
              }`}>
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
