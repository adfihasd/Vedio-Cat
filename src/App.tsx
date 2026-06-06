import { useCallback, useState } from 'react'
import type { VideoInfo, OLEDFrame, DitherAlgorithm, FitMode, AppStep } from './types'
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
  const [fitMode, setFitMode] = useState<FitMode>('letterbox')
  const [invert, setInvert] = useState(false)
  const [sampleGray, setSampleGray] = useState<Uint8Array | null>(null)
  const [frames, setFrames] = useState<OLEDFrame[]>([])
  const [processing, setProcessing] = useState(false)

  const handleVideoReady = useCallback(async (f: File, info: VideoInfo) => {
    setFile(f)
    setVideoInfo(info)
    setStep(2)

    // Pre-extract middle frame for preview
    const midTs = info.duration / 2
    const gray = await extractRawFrame(f, midTs, 128, 64, fitMode)
    setSampleGray(gray)
  }, [])

  const handleProcess = useCallback(async () => {
    if (!file) return
    setProcessing(true)
    try {
      const rawFrames = await extractAllFrames(file, fps, 128, 64, fitMode, (cur, total) => {
        console.log(`Extracting ${cur}/${total}`)
      })
      const oledFrames = rawFrames.map((raw) => processFrame(raw, algorithm, 128, 64, invert))
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
            fitMode={fitMode}
            onFitModeChange={setFitMode}
            invert={invert}
            onInvertChange={setInvert}
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
