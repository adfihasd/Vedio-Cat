import type { VideoInfo, DitherAlgorithm, FitMode } from '../types'
import { DITHER_OPTIONS, FIT_OPTIONS } from '../types'

interface Props {
  videoInfo: VideoInfo
  fps: number
  onFpsChange: (fps: number) => void
  algorithm: DitherAlgorithm
  onAlgorithmChange: (alg: DitherAlgorithm) => void
  fitMode: FitMode
  onFitModeChange: (mode: FitMode) => void
  invert: boolean
  onInvertChange: (invert: boolean) => void
  onProcess: () => void
  processing: boolean
}

const STM32_FLASH_KB = 60

export default function FrameConfig({
  videoInfo, fps, onFpsChange, algorithm, onAlgorithmChange,
  fitMode, onFitModeChange, invert, onInvertChange, onProcess, processing
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

      {/* Fit mode selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">画面适配</label>
        <div className="flex gap-2">
          {FIT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onFitModeChange(key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition
                ${fitMode === key
                  ? 'bg-blue-600 text-white'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >
              {label}
            </button>
          ))}
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

      {/* Invert toggle */}
      <div className="mb-6 flex items-center justify-between bg-zinc-800 rounded-lg p-4">
        <div>
          <span className="text-sm font-medium">反转颜色</span>
          <p className="text-xs text-zinc-400 mt-0.5">暗背景、亮轮廓</p>
        </div>
        <button
          onClick={() => onInvertChange(!invert)}
          className={`relative w-11 h-6 rounded-full transition-colors ${
            invert ? 'bg-blue-600' : 'bg-zinc-600'
          }`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            invert ? 'translate-x-5' : 'translate-x-0.5'
          }`} />
        </button>
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
