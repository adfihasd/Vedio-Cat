# Video → OLED 帧切取工具 - 设计文档

**日期**: 2026-06-06 | **状态**: 已确认

## 1. 目标

构建一个纯前端网站，上传短视频 → 按自定义帧率切帧 → 二值化（多算法对比预览）→ 导出 SSD1306 OLED 兼容的 C 数组 `.h` 文件，直接用于 STM32 工程播放。

## 2. 技术选型

| 项目 | 选择 |
|------|------|
| 技术栈 | 纯前端 React + Vite |
| 切帧引擎 | @ffmpeg/ffmpeg (WASM) |
| 图像处理 | Canvas API |
| 样式 | Tailwind CSS |
| 输出格式 | C `.h` 文件，对齐 `OLED_Data.c` 中 `Diode[]` 风格 |

## 3. OLED 数据格式 (SSD1306)

- 分辨率: 128 × 64 像素，单色（1 bit/像素）
- 每字节 = 8 垂直像素（LSB = 顶部像素）
- 数据排列: Page-major → Page 0 col 0-127, Page 1 col 0-127, ..., Page 7 col 0-127
- 1 帧 = 8 pages × 128 cols = **1024 字节**
- 调用方式: `OLED_ShowImage(0, 0, 128, 64, frame_data); OLED_Update();`
- Hex 风格: `0x` 小写前缀，逗号分隔，16 bytes/行

## 4. 页面流程（4 步）

### Step 1: 视频上载
- 拖拽或点击选择视频文件（mp4/mov/avi/webm）
- 用 ffmpeg.wasm 读取元数据：时长、原始分辨率、编码格式
- 显示视频基本信息

### Step 2: 切帧配置
- 帧率滑块（1-30 fps），默认 10
- 实时计算显示：总帧数、占用 KB、预估 Flash 占用
- 超出 60KB（典型 F103C8 可用 Flash）红色预警
- 可选手动输入起止时间裁剪片段

### Step 3: 算法预览
- 3 列并排对比预览（取中间一帧作为样本）:
  - 简单阈值 (threshold=128)
  - Floyd-Steinberg 误差扩散
  - Atkinson 抖动
- 每列显示算法名 + 处理结果（128×64 放大显示）
- 点击选择最终算法

### Step 4: 导出
- 生成 `video_frames.h`，格式对齐现有 `OLED_Data.c` 中 `Diode[]`
- 内容：`const uint8_t video_frame_XXX[1024] = { ... };` × N 帧
- 附带宏定义: `VIDEO_FRAME_COUNT`, `VIDEO_FPS`
- 一键下载 `.h` 文件

## 5. 组件树

```
App
├── Step1Upload        (文件拖拽、视频元信息)
├── Step2Config        (帧率滑块、帧数预算、时间裁剪)
├── Step3Preview       (3 列算法对比、Canvas 渲染 128×64)
│   ├── PreviewColumn  (×3: 算法名 + 放大预览)
└── Step4Export        (下载按钮、文件名预览)
```

## 6. 数据流

```
File (用户选择)
  → ffmpeg.wasm 读取元数据
  → 用户配置帧率 → 计算帧数
  → ffmpeg.wasm 逐帧提取 (ImageData[])
  → Canvas 缩放至 128×64 灰度
  → 三算法二值化 → Canvas 预览
  → 选定算法 → 全部帧转为 SSD1306 字节数组
  → 拼接为 .h 文本 → Blob 下载
```

## 7. 约束与边界

- 纯前端，无后端/无服务器
- 首次加载 ffmpeg.wasm (~30MB) 需要等待（显示进度）
- 短视频（< 30 秒），大视频可能耗尽浏览器内存
- 支持 Chrome/Edge/Firefox 现代浏览器
- 输出仅 C `.h` 格式，不做二进制导出

## 8. 验收标准

- [ ] 上传 mp4 视频，正确显示时长和分辨率
- [ ] 帧率滑块联动帧数和容量显示
- [ ] 3 种二值化算法可实时预览对比
- [ ] 导出的 .h 文件可在 STM32 工程中直接 `#include` 并调用 `OLED_ShowImage`
- [ ] 生成的 hex 数据格式与 `Diode[]` 完全一致
