import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import type { FitMode, VideoInfo } from '../types'

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

  const logs: string[] = []
  const onLog = ({ message }: { message: string }) => logs.push(message)
  fm.on('log', onLog)

  await fm.exec(['-i', inputName, '-f', 'null', '-'])

  fm.off('log', onLog)

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

/** Extract a single frame at given timestamp (seconds) as raw grayscale bytes */
export async function extractRawFrame(
  file: File,
  timestampSec: number,
  outW = 128,
  outH = 64,
  fitMode: FitMode = 'letterbox'
): Promise<Uint8Array> {
  const fm = await loadFFmpeg()
  const inputName = 'v' + Date.now() + getExt(file.name)

  const vf = fitMode === 'letterbox'
    ? `scale=${outW}:${outH}:force_original_aspect_ratio=decrease,pad=${outW}:${outH}:(ow-iw)/2:(oh-ih)/2:black`
    : `scale=${outW}:${outH}`  // stretch: simple resize

  await fm.writeFile(inputName, await fetchFile(file))
  await fm.exec([
    '-ss', timestampSec.toFixed(3),
    '-i', inputName,
    '-vframes', '1',
    '-vf', vf,
    '-pix_fmt', 'gray',
    '-f', 'rawvideo',
    'out.raw'
  ])

  const data = await fm.readFile('out.raw')
  await fm.deleteFile(inputName)
  await fm.deleteFile('out.raw')

  return data as Uint8Array
}

/** Extract all frames at regular intervals given fps */
export async function extractAllFrames(
  file: File,
  fps: number,
  outW = 128,
  outH = 64,
  fitMode: FitMode = 'letterbox',
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array[]> {
  const info = await getVideoInfo(file)
  const totalFrames = Math.floor(info.duration * fps)
  const frames: Uint8Array[] = []

  for (let i = 0; i < totalFrames; i++) {
    const ts = i / fps
    const raw = await extractRawFrame(file, ts, outW, outH, fitMode)
    frames.push(raw)
    onProgress?.(i + 1, totalFrames)
  }

  return frames
}

function getExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i) : '.mp4'
}
