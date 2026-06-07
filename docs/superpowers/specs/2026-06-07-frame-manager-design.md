# 帧管理功能 - 设计文档

**日期**: 2026-06-07 | **状态**: 待确认

## 1. 目标

在现有 Video → OLED 帧切取工具的 Step 3（算法预览）和 Step 4（导出）之间，插入帧管理步骤，让用户可以预览每一帧切片画面，根据需要切换保留/排除，最终只导出保留的帧。

## 2. 流程变更

```
现有: Step 1 (上传) → Step 2 (配置) → Step 4 (导出)   [Step 3 被跳过]
新增: Step 1 (上传) → Step 2 (配置) → Step 3 (算法预览) → Step 4 (帧管理) → Step 5 (导出)
```

### AppStep 类型

```typescript
// 原来: 1 | 2 | 3 | 4
// 变为: 1 | 2 | 3 | 4 | 5
export type AppStep = 1 | 2 | 3 | 4 | 5
```

### 步骤流转规则

| 触发 | 目标 Step | 副作用 |
|------|-----------|--------|
| 视频上传就绪 | 2 | 提取中间帧样本 |
| 开始切帧 | 3 | 提取全部 rawFrames |
| 算法预览 → 下一步 | 4 | - |
| 帧管理 → 返回算法 | 3 | 清空 excludedFrames |
| 帧管理 → 返回配置 | 2 | 清空 rawFrames, excludedFrames |
| 帧管理 → 下一步 | 5 | - |
| 导出页 → 重新开始 | 1 | 全部重置 |

## 3. 数据模型

### App.tsx 新增状态

```typescript
// 所有帧的原始灰度数据（128×64 单通道，每帧 8192 bytes）
// 提取一次，贯穿 Step 3/4/5
const [rawFrames, setRawFrames] = useState<Uint8Array[]>([])

// 被排除的帧序号集合（非破坏性操作）
const [excludedFrames, setExcludedFrames] = useState<Set<number>>(new Set())

// 胶片条当前选中的帧序号
const [selectedFrameIndex, setSelectedFrameIndex] = useState(0)
```

### 帧数据生命周期

```
extractAllFrames(file, fps, ...)
  → rawFrames: Uint8Array[]    (原始灰度，永远保留不修改)
  → 传给 Step 3: 取中间帧 → 三算法对比
  → 传给 Step 4: 逐帧渲染缩略图 + 大预览
  → 传给 Step 5: 逐个 processFrame(raw, algo) → 过滤 excludedFrames → 导出
```

## 4. 新组件：FrameManager（Step 4）

### 布局

```
┌──────────────────────────────────────────────────┐
│  Step 4: 帧管理          [18/24 帧保留 · 6 排除]  │
├──────────────────────────────────────────────────┤
│                                                   │
│          ┌────────────────────────────┐           │
│          │                            │           │
│          │  大预览 Canvas             │           │
│          │  等比例放大 (2:1)          │  ← 128:64 │
│          │  像素级清晰 (imageSmoothing │ 等比缩放  │
│          │  Enabled = false)          │           │
│          │                            │           │
│          └────────────────────────────┘           │
│          帧 #12 · 1.20s · ✓ 保留                 │
│                                                   │
│  ◄── ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐ ──►       │
│      │  │  │  │▓▓│  │  │  │  │  │  │            │
│      └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘            │
│      胶片条 (2x 缩略图, 滚轮/拖拽横向滚动)       │
│      排除帧：半透明 + 红色边框                    │
│      快捷键：← → 切帧 · Space 切换保留/排除      │
│                                                   │
│  [← 返回算法]                    [下一步: 导出 →] │
└──────────────────────────────────────────────────┘
```

### 缩略图渲染

- 每帧原始灰度数据 128×64 → 用选定算法二值化 → Canvas 渲染
- 缩略图尺寸：128×64 → 2x 等比放大 = 256×128 像素
- 使用 `imageSmoothingEnabled = false` 保持像素锐利
- 排除帧：叠加半透明遮罩 + 红色边框

### 大预览

- 选中帧 128×64 → **等比例放大**（保持 2:1 宽高比），不拉伸变形
- 建议放大倍率：容器自适应，取容器宽度和高度中较小的那个方向计算等比缩放
- `imageSmoothingEnabled = false`，像素级显示

### 键盘快捷键

| 按键 | 行为 |
|------|------|
| `←` | 选中上一帧（到头停止） |
| `→` | 选中下一帧（到尾停止） |
| `Space` | 切换当前帧保留/排除 |

### 胶片条交互

- 鼠标滚轮：横向滚动
- 鼠标拖拽：横向拖拽滚动
- 点击缩略图：选中该帧
- 选中帧高亮边框（蓝色），排除帧半透明 + 红边框

### Props

```typescript
interface Props {
  rawFrames: Uint8Array[]           // 所有原始灰度帧
  algorithm: DitherAlgorithm        // 当前选定的算法
  excludedFrames: Set<number>       // 被排除的帧序号
  onToggleFrame: (index: number) => void
  selectedFrameIndex: number
  onSelectFrame: (index: number) => void
  onBack: () => void                // 返回 Step 3
  onNext: () => void                // 进入 Step 5
}
```

### 边界处理

- **全部排除**：禁用"下一步"按钮，提示"请至少保留一帧"
- **仅 1 帧**：胶片条单张缩略图，左右箭头无操作
- **超过 Flash 预算**：顶部提示条"当前保留 N 帧占用 X KB，超出建议"

## 5. 现有组件改动

### types.ts

- `AppStep` 从 `1 | 2 | 3 | 4` 扩展为 `1 | 2 | 3 | 4 | 5`

### App.tsx

- 新增 3 个状态：`rawFrames`, `excludedFrames`, `selectedFrameIndex`
- `handleProcess`：提取完成后跳 Step 3（原跳 Step 4）
- 新增 `handleGoFrameManager`：从 Step 3 进 Step 4
- 新增 `handleBackToAlgorithm`：从 Step 4 返回 Step 3，重置 `excludedFrames`
- `handleReset`：清空所有新增状态
- Step 4 渲染 `FrameManager`，Step 5 渲染 `ExportPanel`

### FrameConfig.tsx

- 无 UI 改动，`handleProcess` 回调改为跳 Step 3

### DitherPreview.tsx（Step 3）

- 底部新增"下一步：帧管理 →"按钮
- Props 新增 `onNext` 回调

### ExportPanel.tsx（Step 5）

- Props 新增 `excludedFrames: Set<number>`
- Props 新增 `rawFrames: Uint8Array[]`（替代原来的 `frames: OLEDFrame[]`）
- 导出前实时处理：`rawFrames.filter((_, i) => !excludedFrames.has(i)).map(r => processFrame(r, algo))`
- 更新统计信息显示保留帧数/总帧数

## 6. 数据流

```
File
  → ffmpeg.wasm extractAllFrames()
  → rawFrames: Uint8Array[]  (128×64 grayscale each)
      │
      ├── Step 3: DitherPreview
      │   └── rawFrames[mid] → 三算法二值化 → Canvas 对比
      │
      ├── Step 4: FrameManager
      │   ├── rawFrames[i] → processFrame(algorithm) → 缩略图 Canvas (2x)
      │   ├── rawFrames[selected] → processFrame(algorithm) → 大预览 Canvas (等比)
      │   └── 用户操作 → excludedFrames Set 增删
      │
      └── Step 5: ExportPanel
          └── rawFrames 过滤 excludedFrames → processFrame → OLEDFrame[]
              → generateVideoHeader() → download .h
```

## 7. 验收标准

- [ ] 流程走通：上传 → 配置 → 切帧 → 算法预览 → 帧管理 → 导出
- [ ] 胶片条展示所有帧缩略图，水平滚轮/拖拽滚动
- [ ] 大预览区域 128:64 等比例放大，像素级显示（无模糊）
- [ ] 点击缩略图切换大预览，← → 键切换帧
- [ ] Space 键切换保留/排除，UI 即时反馈
- [ ] 排除帧显示半透明 + 红边框
- [ ] 全部排除时禁用"下一步"并提示
- [ ] 返回算法页后 excludedFrames 清空
- [ ] 导出 .h 文件仅包含保留帧，帧序号连续重排
- [ ] 导出 .h 文件格式与现有 Diode[] 风格一致
