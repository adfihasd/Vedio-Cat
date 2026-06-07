# CLAUDE.md — Video → OLED 帧切取工具

## 项目概述

纯浏览器端工具，将视频转换为 SSD1306 128×64 单色 OLED 可用的 C 头文件。

## 技术栈

- React 19 + TypeScript + Vite 8 + Tailwind CSS 4
- ffmpeg.wasm 0.12（单核版）
- 包管理：npm

## 命令

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run preview  # 预览构建
npm run lint     # ESLint
npx tsc --noEmit # 类型检查
```

## 架构

```
src/
├── App.tsx          # 主组件 — 5 步状态机调度
├── types.ts         # 共享类型定义
├── lib/
│   ├── ffmpeg.ts    # ffmpeg.wasm 封装
│   ├── dither.ts    # 3 种二值化算法 + SSD1306 打包
│   └── oled-export.ts # C 头文件生成下载
└── components/
    ├── VideoUploader.tsx  # Step 1: 上传
    ├── FrameConfig.tsx    # Step 2: 配置
    ├── DitherPreview.tsx  # Step 3: 预览 + 阈值滑块
    ├── FrameManager.tsx   # Step 4: 帧管理
    └── ExportPanel.tsx    # Step 5: 导出
```

## 5 步流程

1. 上传视频 → 初始化 ffmpeg.wasm
2. 配置 fps / fitMode / invert / 算法
3. 中间帧三算法对比预览 + 阈值滑块（仅阈值算法）
4. 胶片条帧管理 — 保留/排除每一帧
5. 导出 video_frames.h

## 关键数据流

- `rawFrames: Uint8Array[]` — 原始灰度帧，提取一次贯穿 Step 3–5
- `thresholdValue: number` — 简单阈值算法的阈值（0–255，默认 128）
- `excludedFrames: Set<number>` — 被排除的帧序号集合
- `sampleGray: Uint8Array` — 中间帧原始灰度，用于 Step 3 预览
