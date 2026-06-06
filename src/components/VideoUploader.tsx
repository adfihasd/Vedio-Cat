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
