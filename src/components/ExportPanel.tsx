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
