# 🎬 Video → OLED 帧切取工具

将视频转换为 SSD1306 128×64 单色 OLED 显示屏可用的 C 头文件（`.h`），一键生成嵌入式播放代码。

---

## ✨ 功能特性

- **纯浏览器端处理** — 基于 ffmpeg.wasm，视频不上传服务器，隐私安全
- **5 步向导流程** — 上传 → 配置 → 算法预览 → **帧管理** → 导出，操作清晰
- **3 种二值化算法** — 简单阈值（阈值可调 0–255）、Floyd-Steinberg、Atkinson 误差扩散抖动
- **中间帧实时预览** — 4 倍放大对比不同算法的效果
- **帧管理（新增）** — 胶片条浏览每一帧，保留/排除自由切换，所见即所得
- **灵活帧率控制** — 1–30 fps 可调，实时显示 Flash 占用估算
- **画面适配模式** — 拉伸填充 / 等比居中（letterbox）
- **颜色反转** — 暗背景亮轮廓 / 亮背景暗轮廓一键切换
- **导出 C 头文件** — 生成 `video_frames.h`，含帧数据 + 指针表，直接嵌入 STM32 工程
- **Flash 预算提示** — 超过 60KB 时自动警告（适配 STM32F103C8T6 等常见型号）

---

## 🛠 技术栈

| 类型 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS 4 |
| 视频处理 | ffmpeg.wasm 0.12 |
| 包管理 | npm |

---

## 🚀 本地运行

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装与启动

```bash
# 克隆仓库
git clone https://gitee.com/xiaobo-xiaoc/vedio.git
cd vedio

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

浏览器打开 `http://localhost:5173` 即可使用。

### 其他命令

```bash
npm run build    # 生产构建，输出到 dist/
npm run preview  # 预览生产构建
npm run lint     # 代码检查
```

---

## 📖 使用说明

### Step 1 — 上传视频

首次使用需点击「初始化引擎」下载 ffmpeg.wasm（约 30MB，仅首次需要），之后拖拽或选择视频文件（支持 mp4 / mov / avi / webm）。

### Step 2 — 切帧配置

| 参数 | 说明 |
|------|------|
| **帧率 (fps)** | 每秒提取多少帧，越高越流畅但占用空间越大 |
| **画面适配** | `拉伸填充` 直接缩放到 128×64；`等比居中` 保持比例，不足处填黑边 |
| **二值化算法** | 灰度 → 黑白单色的转换方式 |
| **反转颜色** | 开启后暗色变亮、亮色变暗，适合暗底亮线的显示风格 |

界面会实时显示预计帧数和 Flash 占用大小，超过 60KB 会有红色警告。

点击「开始切帧」进入下一步。

### Step 3 — 对比预览

取视频中间帧，用三种算法分别处理后放大 4 倍展示。点击即可切换算法，观察细节差异。

选择「简单阈值」时，会出现**可调阈值滑块**（0–255），拖动实时预览阈值效果。

选择算法后点击「下一步：帧管理」。

### Step 4 — 帧管理（新增）

- **胶片条**：所有帧以 2x 缩略图横向排列，鼠标滚轮或拖拽横向滚动
- **大预览**：点击任意缩略图，上方显示该帧等比例放大预览（保持 128:64 比例）
- **保留/排除**：双击缩略图或按 `Space` 切换，排除帧显示红色边框 + 半透明
- **键盘快捷键**：`←` `→` 切换帧，`Space` 切换保留/排除
- **容量提示**：实时显示保留帧数及 Flash 占用

调整完毕后点击「下一步：导出」。

### Step 5 — 导出

点击「下载 video_frames.h」获取 C 头文件，仅包含保留的帧，将其放入 STM32 工程即可。

### STM32 端播放示例

```c
#include "video_frames.h"

// 逐帧播放
for (int f = 0; f < VIDEO_FRAME_COUNT; f++) {
    OLED_ShowImage(0, 0, 128, 64, video_frames[f]);
    OLED_Update();
    Delay_ms(1000 / VIDEO_FPS);
}
```

---

## 🧠 抖动算法对比

| 算法 | 特点 | 适用场景 |
|------|------|----------|
| **简单阈值** | 像素值 > 127 亮，否则暗，速度最快 | 高对比度画面 |
| **Floyd-Steinberg** | 误差扩散，细节丰富，经典算法 | 照片级画面、渐变过渡 |
| **Atkinson** | 误差扩散范围更大，风格化强 | 艺术效果、复古风格 |

---

## 📂 项目结构

```
├── index.html              # 入口 HTML
├── package.json            # 依赖与脚本
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── eslint.config.js        # ESLint 配置
├── public/
│   └── icons.svg           # 静态图标
└── src/
    ├── main.tsx            # 应用入口
    ├── App.tsx             # 主组件（5 步状态机调度）
    ├── index.css           # Tailwind 全局样式
    ├── types.ts            # 类型定义
    ├── lib/
    │   ├── ffmpeg.ts       # ffmpeg.wasm 封装（帧提取）
    │   ├── dither.ts       # 抖动算法实现 + SSD1306 打包
    │   └── oled-export.ts  # C 头文件生成与下载
    └── components/
        ├── VideoUploader.tsx   # Step 1: 视频上传
        ├── FrameConfig.tsx     # Step 2: 参数配置
        ├── DitherPreview.tsx   # Step 3: 预览对比
        ├── FrameManager.tsx    # Step 4: 帧管理（胶片条 + 保留/排除）
        └── ExportPanel.tsx     # Step 5: 导出
```

---

## ⚠️ 注意事项

- ffmpeg.wasm 首次加载需下载约 30MB 资源，请保持网络畅通
- 仅支持单核（Core）版本的 ffmpeg.wasm，处理速度取决于浏览器性能
- 生成的 `video_frames.h` 格式为 SSD1306 page-column（8 pages × 128 columns = 1024 bytes/帧）
- 建议帧数控制在 60 帧以内（约 60KB），超出可能导致 STM32 Flash 不足
- 帧管理页面可通过排除多余帧来控制最终导出大小

---

## 📄 License

MIT
