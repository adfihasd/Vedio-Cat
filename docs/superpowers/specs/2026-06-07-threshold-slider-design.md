# 简单阈值算法 — 可调阈值滑块设计

**日期**: 2026-06-07 | **状态**: 待确认

## 1. 目标

为「简单阈值」算法添加可调节的阈值参数（0–255，默认 128），在 Step 3 预览页通过滑块实时调节并即时预览效果。

## 2. 交互设计

- **位置**：Step 3（DitherPreview），算法 3 列对比下方
- **可见条件**：仅当用户选中「简单阈值」算法时出现
- **控件**：纯 range slider（0–255），无预设按钮
- **数值显示**：滑块上方显示当前值（如 `阈值: 128`）
- **预览**：拖动滑块 → 「简单阈值」预览图实时更新（`onInput`，非 `onChange`）
- **选中其他算法**：滑块隐藏，阈值值保留不丢失

## 3. 数据模型

### App.tsx 新增状态

```typescript
const [thresholdValue, setThresholdValue] = useState(128)
```

### 阈值数据流

```
App.tsx  thresholdValue: number (default 128)
  ├─→ DitherPreview   ← 滑块在这里，实时预览
  ├─→ FrameManager    ← 缩略图 / 大预览渲染用此阈值
  └─→ ExportPanel     ← 最终导出用此阈值
```

### 重置行为

- `handleReset`：重置为 128
- `handleBackToAlgorithm`（Step 4 → 3）：不清空，保留用户之前调的阈值
- 上传新视频：保留当前阈值不变

## 4. 改动范围

### types.ts
- 无需改动（thresholdValue 是 number，不需要新类型）

### lib/dither.ts
- `threshold(data, thresholdValue)` — 添加阈值参数，默认 128
- `applyDither(data, algorithm, width, height, thresholdValue?)` — 透传阈值
- `processFrame(grayData, algorithm, width, height, thresholdValue?)` — 透传阈值
- `floydSteinberg` / `atkinson` — 不受影响，保持内部 127 截止值不变

### App.tsx
- 新增 `const [thresholdValue, setThresholdValue] = useState(128)`
- 传给 `DitherPreview`：`thresholdValue` + `onThresholdChange={setThresholdValue}`
- 传给 `FrameManager`：`thresholdValue`
- 传给 `ExportPanel`：`thresholdValue`
- `handleReset`：重置为 128

### components/DitherPreview.tsx
- Props 新增：`thresholdValue: number`, `onThresholdChange: (v: number) => void`
- 选中 `threshold` 算法时渲染滑块（条件渲染）
- 滑块 `onInput` 调用 `onThresholdChange`
- `applyDither(sampleGray, key, 128, 64, thresholdValue)` 仅对 threshold 算法传阈值
- 其他算法保持原有调用方式

### components/FrameManager.tsx
- Props 新增：`thresholdValue: number`
- 渲染缩略图/大预览时，对 threshold 算法传入 thresholdValue

### components/ExportPanel.tsx
- Props 新增：`thresholdValue: number`
- `processFrame(raw, algorithm, 128, 64, thresholdValue)` 透传阈值

### components/FrameConfig.tsx
- 无改动

## 5. 边界处理

- **阈值 0**：所有像素都 > 0 → 全白画面
- **阈值 255**：所有像素都 ≤ 255 → 全黑画面
- **切换算法**：滑块隐藏但值保留，切回「简单阈值」时恢复
- **滑块两端**：min=0, max=255, step=1

## 6. 验收标准

- [ ] Step 3 选中「简单阈值」时出现阈值滑块，默认值 128
- [ ] 拖动滑块 → 简单阈值预览图实时更新
- [ ] 选中 Floyd-Steinberg / Atkinson 时滑块隐藏
- [ ] 阈值值贯穿 Step 3 → 4 → 5，帧管理和导出使用相同阈值
- [ ] 重置后阈值恢复 128
- [ ] npm run build 无错误
