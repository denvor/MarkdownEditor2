## Context

当前布局使用 CSS flexbox：`.main-area` 为 flex 容器，两个 `.pane` 各设 `flex: 1` 实现 50/50 均分。`.editor-pane` 有 `border-right` 作为视觉分隔，但不可交互。

目标：在两个 pane 之间添加一个可拖动的分隔条，用户可通过鼠标拖动调整两侧宽度比例。

## Goals / Non-Goals

**Goals:**
- 可拖动的分隔条，实时调整编辑区/预览区宽度
- 最小宽度限制（每侧 200px）
- 拖动时视觉反馈（高亮 + 禁用文本选择）
- 窗口 resize 时保持当前比例

**Non-Goals:**
- 不持久化宽度比例到配置（重启后恢复 50/50）
- 不支持触摸拖动（仅鼠标）
- 不添加折叠/展开功能

## Decisions

### 1. 布局方案：百分比 flex-basis

**决策：** 分隔条将两个 pane 的 `flex` 从 `flex: 1` 改为基于百分比的 `flex-basis`。拖动时根据鼠标位置计算百分比并更新。

**替代方案考虑：**
- CSS `resize` + `overflow: auto` — 只允许调整单个元素，不好控制对侧
- CSS Grid `grid-template-columns` + `fr` — 也可行但需要更复杂的拖动计算
- 绝对定位 overlay — 过于复杂

**选择理由：** flex-basis + 百分比最简洁，与现有布局一致，窗口 resize 时浏览器自动按比例分配。

### 2. 分隔条实现

**决策：** 添加独立的 `<div class="divider" id="divider">` 元素，固定宽度 4px，使用 `flex-shrink: 0` 防止被压缩。

**实现细节：**
- `mousedown` 在 divider 上启动拖动
- `mousemove` 在 `document` 上监听，计算相对 `.main-area` 的百分比位置
- `mouseup` 结束拖动，移除监听器
- 拖动期间给 `body` 添加 `.dragging` 类控制光标和高亮

### 3. 拖动计算

```js
const rect = mainArea.getBoundingClientRect();
const percent = ((e.clientX - rect.left) / rect.width) * 100;
const clamped = Math.min(Math.max(percent, MIN_PERCENT), 100 - MIN_PERCENT);
editorPane.style.flexBasis = clamped + '%';
previewPane.style.flexBasis = (100 - clamped) + '%';
```

其中 `MIN_PERCENT` 对应 200px 最小宽度。

### 4. 最小宽度

**决策：** 使用百分比 clamp 而非固定 px。`MIN_PERCENT = 200 / window.innerWidth * 100`，在拖动时动态计算。

**理由：** 窗口 resize 时最小百分比需要重新计算，但 clamp 在拖动时执行，所以直接使用当前窗口宽度即可。

## Risks / Trade-offs

- **窗口 resize 后 MIN_PERCENT 不更新** → 可接受，因为 clamp 只在拖动时生效，且用户通常不会在拖动过程中 resize 窗口
- **WebView2 对 flex-basis 支持** → WebView2 基于 Chromium，完全支持 flexbox，无兼容性问题
