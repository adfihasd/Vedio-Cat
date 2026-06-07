import { useCallback, useState } from 'react'
import type { VideoInfo, DitherAlgorithm, FitMode, AppStep } from './types'
import VideoUploader from './components/VideoUploader'
import FrameConfig from './components/FrameConfig'
import DitherPreview from './components/DitherPreview'
import FrameManager from './components/FrameManager'
import ExportPanel from './components/ExportPanel'
import { extractRawFrame, extractAllFrames } from './lib/ffmpeg'

export default function App() {
  const [step, setStep] = useState<AppStep>(1)
  const [file, setFile] = useState<File | null>(null)
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null)
  const [fps, setFps] = useState(10)
  const [algorithm, setAlgorithm] = useState<DitherAlgorithm>('floyd-steinberg')
  const [fitMode, setFitMode] = useState<FitMode>('letterbox')
  const [invert, setInvert] = useState(false)
  const [sampleGray, setSampleGray] = useState<Uint8Array | null>(null)
  const [processing, setProcessing] = useState(false)

  // New state for 5-step flow
  const [rawFrames, setRawFrames] = useState<Uint8Array[]>([])
  const [excludedFrames, setExcludedFrames] = useState<Set<number>>(new Set())
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)

  const handleVideoReady = useCallback(async (f: File, info: VideoInfo) => {
    setFile(f)
    setVideoInfo(info)
    setStep(2)

    // Pre-extract middle frame for preview
    const midTs = info.duration / 2
    const gray = await extractRawFrame(f, midTs, 128, 64, fitMode, invert)
    setSampleGray(gray)
  }, [fitMode, invert])

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

  const handleReset = () => {
    setStep(1)
    setFile(null)
    setVideoInfo(null)
    setSampleGray(null)
    setRawFrames([])
    setExcludedFrames(new Set())
    setSelectedFrameIndex(0)
    setFps(10)
    setAlgorithm('floyd-steinberg')
    setFitMode('letterbox')
    setInvert(false)
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
            {([1, 2, 3, 4, 5] as AppStep[]).map((s) => (
              <div key={s} className={`w-6 h-1 rounded-full transition
                ${s <= step ? 'bg-blue-500' : 'bg-zinc-700'}`}
              />
            ))}
          </div>
        </div>
      </header>

      <main className="px-6 pb-12">
        {/* Step 1: Upload */}
        {step === 1 && <VideoUploader onVideoReady={handleVideoReady} />}

        {/* Step 2: Config (visible from step 2 onward) */}
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

        {/* Step 3: Algorithm preview */}
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

        {/* Step 4: Frame manager */}
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

        {/* Step 5: Export */}
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
    </div>
  )
}
