# 可调阈值滑块 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为简单阈值算法添加 0–255 可调阈值滑块，在 Step 3 实时预览，贯穿 Step 4/5 使用

**Architecture:** thresholdValue 状态存在 App.tsx，向下流动到 DitherPreview（滑块 + 预览）、FrameManager（缩略图/大预览）、ExportPanel（导出）。dither.ts 的 threshold/applyDither/processFrame 添加可选 thresholdValue 参数，默认 128 保持向后兼容。

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4

---

## File Structure

```
src/
├── lib/
│   └── dither.ts                  # Modify: add thresholdValue parameter
├── App.tsx                        # Modify: new state, wire to all consumers
├── components/
│   ├── DitherPreview.tsx          # Modify: slider UI + pass threshold
│   ├── FrameManager.tsx           # Modify: accept + pass thresholdValue
│   └── ExportPanel.tsx            # Modify: accept + pass thresholdValue
```

---

### Task 1: Update dither.ts — add thresholdValue parameter

**Files:** Modify: `src/lib/dither.ts`

- [ ] **Step 1: Add thresholdValue parameter to threshold()**

Change lines 4–10:

```typescript
/** Simple threshold: pixel > threshold → 1, <= threshold → 0 */
export function threshold(data: Uint8Array, thresholdValue = 128): Uint8Array {
  const bin = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    bin[i] = data[i] > thresholdValue ? 1 : 0
  }
  return bin
}
```

- [ ] **Step 2: Add thresholdValue parameter to applyDither()**

Change lines 85–96:

```typescript
/** Apply dithering by name */
export function applyDither(
  data: Uint8Array,
  algorithm: DitherAlgorithm,
  width = 128,
  height = 64,
  thresholdValue = 128
): Uint8Array {
  switch (algorithm) {
    case 'threshold':       return threshold(data, thresholdValue)
    case 'floyd-steinberg': return floydSteinberg(data, width, height)
    case 'atkinson':        return atkinson(data, width, height)
  }
}
```

- [ ] **Step 3: Add thresholdValue parameter to processFrame()**

Change lines 99–107:

```typescript
/** Full pipeline: raw grayscale → dither → OLED packed bytes */
export function processFrame(
  grayData: Uint8Array,
  algorithm: DitherAlgorithm,
  width = 128,
  height = 64,
  thresholdValue = 128
): OLEDFrame {
  const binary = applyDither(grayData, algorithm, width, height, thresholdValue)
  return packOLED(binary, width, height)
}
```

- [ ] **Step 4: Verify no TypeScript errors in dither.ts**

```bash
npx tsc --noEmit src/lib/dither.ts 2>&1 | head -20
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/dither.ts && git commit -m "feat: add thresholdValue parameter to dither pipeline"
```

---

### Task 2: Update App.tsx — add state and wire props

**Files:** Modify: `src/App.tsx`

- [ ] **Step 1: Add thresholdValue state**

After line 18 (`const [processing, setProcessing] = useState(false)`):

```typescript
const [thresholdValue, setThresholdValue] = useState(128)
```

- [ ] **Step 2: Pass thresholdValue to DitherPreview**

In the JSX where DitherPreview is rendered (line ~133), add the two new props:

```typescript
{step === 3 && sampleGray && (
  <div className="mt-10">
    <DitherPreview
      sampleGray={sampleGray}
      selected={algorithm}
      onSelect={setAlgorithm}
      onNext={handleGoFrameManager}
      thresholdValue={thresholdValue}
      onThresholdChange={setThresholdValue}
    />
  </div>
)}
```

- [ ] **Step 3: Pass thresholdValue to FrameManager**

In the JSX where FrameManager is rendered (line ~143), add the prop:

```typescript
{step === 4 && rawFrames.length > 0 && (
  <div className="mt-10">
    <FrameManager
      rawFrames={rawFrames}
      algorithm={algorithm}
      excludedFrames={excludedFrames}
      onToggleFrame={(i) => { /* ... existing ... */ }}
      selectedFrameIndex={selectedFrameIndex}
      onSelectFrame={setSelectedFrameIndex}
      onBack={handleBackToAlgorithm}
      onNext={handleGoExport}
      thresholdValue={thresholdValue}
    />
  </div>
)}
```

- [ ] **Step 4: Pass thresholdValue to ExportPanel**

In the JSX where ExportPanel is rendered (line ~166), add the prop:

```typescript
{step === 5 && rawFrames.length > 0 && (
  <ExportPanel
    rawFrames={rawFrames}
    excludedFrames={excludedFrames}
    fps={fps}
    algorithm={algorithm}
    onReset={handleReset}
    thresholdValue={thresholdValue}
  />
)}
```

- [ ] **Step 5: Reset thresholdValue in handleReset**

In `handleReset` (line ~75), add the reset line after `setInvert(false)`:

```typescript
setThresholdValue(128)
```

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx && git commit -m "feat: wire thresholdValue state through App to all steps"
```

---

### Task 3: Update DitherPreview.tsx — slider UI + live preview

**Files:** Modify: `src/components/DitherPreview.tsx`

- [ ] **Step 1: Add thresholdValue and onThresholdChange to Props**

Change the Props interface (lines 6–11):

```typescript
interface Props {
  sampleGray: Uint8Array | null
  selected: DitherAlgorithm
  onSelect: (alg: DitherAlgorithm) => void
  onNext: () => void
  thresholdValue: number
  onThresholdChange: (v: number) => void
}
```

- [ ] **Step 2: Update component signature to destructure new props**

Change line 48:

```typescript
export default function DitherPreview({ sampleGray, selected, onSelect, onNext, thresholdValue, onThresholdChange }: Props) {
```

- [ ] **Step 3: Update useEffect to pass thresholdValue to applyDither**

Change the useEffect (lines 51–59) to pass thresholdValue:

```typescript
  useEffect(() => {
    if (!sampleGray) return
    for (const { key } of DITHER_OPTIONS) {
      const canvas = canvasRefs.current.get(key)
      if (!canvas) continue
      const binary = applyDither(sampleGray, key, 128, 64, thresholdValue)
      renderToCanvas(canvas, binary)
    }
  }, [sampleGray, thresholdValue])
```

- [ ] **Step 4: Add threshold slider JSX between the grid and the next button**

After the closing `</div>` of the 3-column grid (after the `})` on line ~88), add:

```typescript

      {/* Threshold slider — only visible when 'threshold' algorithm selected */}
      {selected === 'threshold' && (
        <div className="mt-6 bg-zinc-800/50 rounded-xl p-5 border border-zinc-700/50">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-amber-400">🎚 阈值</label>
            <span className="font-mono text-lg font-bold text-amber-400">{thresholdValue}</span>
          </div>
          <input
            type="range"
            min={0}
            max={255}
            value={thresholdValue}
            onInput={(e) => onThresholdChange(+(e.target as HTMLInputElement).value)}
            className="w-full accent-amber-500 h-2"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-2">
            <span>0（全白）</span>
            <span>255（全黑）</span>
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            💡 灰度值 &gt; 阈值 → 亮，≤ 阈值 → 暗。阈值越高画面越暗
          </p>
        </div>
      )}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/DitherPreview.tsx && git commit -m "feat: add threshold slider to DitherPreview with live preview"
```

---

### Task 4: Update FrameManager.tsx — accept and pass thresholdValue

**Files:** Modify: `src/components/FrameManager.tsx`

- [ ] **Step 1: Add thresholdValue to Props**

Change the Props interface (lines 5–14):

```typescript
interface Props {
  rawFrames: Uint8Array[]
  algorithm: DitherAlgorithm
  thresholdValue: number
  excludedFrames: Set<number>
  onToggleFrame: (index: number) => void
  selectedFrameIndex: number
  onSelectFrame: (index: number) => void
  onBack: () => void
  onNext: () => void
}
```

- [ ] **Step 2: Update renderThumbnail — add and use thresholdValue**

Change the function signature and body (lines 17–23):

```typescript
function renderThumbnail(
  canvas: HTMLCanvasElement,
  rawData: Uint8Array,
  algorithm: DitherAlgorithm,
  thresholdValue: number,
  excluded: boolean
) {
  const oled = processFrame(rawData, algorithm, 128, 64, thresholdValue)
```

- [ ] **Step 3: Update renderLargePreview — add and use thresholdValue**

Change the function signature and body (lines 64–71):

```typescript
function renderLargePreview(
  canvas: HTMLCanvasElement,
  rawData: Uint8Array,
  algorithm: DitherAlgorithm,
  thresholdValue: number,
  containerWidth: number,
  containerHeight: number
) {
  const oled = processFrame(rawData, algorithm, 128, 64, thresholdValue)
```

- [ ] **Step 4: Update component destructuring**

Change line 111:

```typescript
export default function FrameManager({
  rawFrames, algorithm, thresholdValue, excludedFrames,
  onToggleFrame, selectedFrameIndex, onSelectFrame,
  onBack, onNext
}: Props) {
```

- [ ] **Step 5: Update thumbnail render effect to pass thresholdValue**

Change the useEffect (line 132):

```typescript
      renderThumbnail(canvas, rawFrames[i], algorithm, thresholdValue, excludedFrames.has(i))
```

And the dependency array (line 134):

```typescript
  }, [rawFrames, algorithm, thresholdValue, excludedFrames])
```

- [ ] **Step 6: Update large preview render effect to pass thresholdValue**

Change the useEffect (line 142):

```typescript
    renderLargePreview(canvas, rawFrames[selectedFrameIndex], algorithm, thresholdValue, rect.width, rect.height)
```

And the dependency array (line 143):

```typescript
  }, [rawFrames, algorithm, thresholdValue, selectedFrameIndex])
```

- [ ] **Step 7: Commit**

```bash
git add src/components/FrameManager.tsx && git commit -m "feat: pass thresholdValue through FrameManager for frame rendering"
```

---

### Task 5: Update ExportPanel.tsx — accept and pass thresholdValue

**Files:** Modify: `src/components/ExportPanel.tsx`

- [ ] **Step 1: Add thresholdValue to Props**

Change the Props interface (lines 6–12):

```typescript
interface Props {
  rawFrames: Uint8Array[]
  excludedFrames: Set<number>
  fps: number
  algorithm: DitherAlgorithm
  thresholdValue: number
  onReset: () => void
}
```

- [ ] **Step 2: Update component signature**

Change line 14:

```typescript
export default function ExportPanel({ rawFrames, excludedFrames, fps, algorithm, thresholdValue, onReset }: Props) {
```

- [ ] **Step 3: Pass thresholdValue to processFrame in useMemo**

Change the useMemo (line 26):

```typescript
      .map(raw => processFrame(raw, algorithm, 128, 64, thresholdValue))
```

And the dependency array (line 27):

```typescript
  }, [rawFrames, excludedFrames, algorithm, thresholdValue])
```

- [ ] **Step 4: Commit**

```bash
git add src/components/ExportPanel.tsx && git commit -m "feat: pass thresholdValue through ExportPanel for final export"
```

---

### Task 6: Build verification

- [ ] **Step 1: Run full TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 2: Run production build**

```bash
npm run build
```
Expected: Build succeeds, no warnings.

- [ ] **Step 3: Start dev server and manual smoke test**

```bash
npm run dev
```

Quick checklist:
1. [ ] Open app → upload video → select "简单阈值" algorithm → see slider at 128
2. [ ] Drag slider → preview updates in real time
3. [ ] Switch to Floyd-Steinberg → slider hides
4. [ ] Switch back to 简单阈值 → slider reappears with previous value
5. [ ] Click "开始切帧" → Step 4 filmstrip renders correctly
6. [ ] Click "下一步导出" → Step 5 shows correct stats
7. [ ] Download .h file → open to verify format

- [ ] **Step 4: Final commit (if any lint/build fixes needed)**

```bash
git add -A && git commit -m "chore: finalize threshold slider feature"
```
