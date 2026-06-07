import { useEffect, useRef } from 'react'
import type { DitherAlgorithm } from '../types'
import { DITHER_OPTIONS } from '../types'
import { applyDither } from '../lib/dither'

interface Props {
  sampleGray: Uint8Array | null   // 128×64 raw grayscale
  selected: DitherAlgorithm
  onSelect: (alg: DitherAlgorithm) => void
  onNext: () => void
  thresholdValue: number
  onThresholdChange: (v: number) => void
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

  const offCanvas = document.createElement('canvas')
  offCanvas.width = width
  offCanvas.height = height
  offCanvas.getContext('2d')!.putImageData(img, 0, 0)

  ctx.imageSmoothingEnabled = false
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height)
}

export default function DitherPreview({ sampleGray, selected, onSelect, onNext, thresholdValue, onThresholdChange }: Props) {
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())

  useEffect(() => {
    if (!sampleGray) return
    for (const { key } of DITHER_OPTIONS) {
      const canvas = canvasRefs.current.get(key)
      if (!canvas) continue
      const binary = applyDither(sampleGray, key, 128, 64, thresholdValue)
      renderToCanvas(canvas, binary)
    }
  }, [sampleGray, thresholdValue])

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

      {/* Threshold slider — only visible when 'threshold' algorithm selected */}
      {selected === 'threshold' && (
        <div className="mt-6 bg-zinc-800/50 rounded-xl p-5 border border-zinc-700/50">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-amber-400">🎚 阈值</label>
            <span className="font-mono text-lg font-bold text-amber-400">{thresholdValue}</span>
          </div>
          <input
            type="range"
            min={0}
            max={255}
            value={thresholdValue}
            onInput={(e) => onThresholdChange(+(e.target as HTMLInputElement).value)}
            className="w-full accent-amber-500 h-2"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-2">
            <span>0（全白）</span>
            <span>255（全黑）</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            💡 灰度值 &gt; 阈值 → 亮，≤ 阈值 → 暗。阈值越高画面越暗
          </p>
        </div>
      )}

      <div className="mt-8 text-center">
        <button
          onClick={onNext}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-bold text-lg transition"
        >
          下一步：帧管理 →
        </button>
      </div>
    </div>
  )
}
