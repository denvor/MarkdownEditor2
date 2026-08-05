## Context

Markdown Editor 当前已实现了左→右的单向滚动同步（编辑器滚动时预览跟随），但右→左没有。代码块在预览区 CSS 中使用了 `pre` 的默认宽度行为，导致代码行过长时被截断。

## Goals / Non-Goals

**Goals:**
- 左右窗口任意一边滚动时，另一边按比例同步跟随
- 预览区代码块内容完整显示，不断行、不截断

**Non-Goals:**
- 不改变现有的 300ms 防抖预览更新机制
- 不修改编辑器自身的滚动行为

## Decisions

### 决策 1：双向同步采用相同比例算法
- 沿用现有比例公式 `scrollTop / (scrollHeight - clientHeight)`
- 左侧滚动 → 同步右侧，右侧滚动 → 同步左侧
- 用防递归守卫 `isSyncing` 避免循环触发

### 决策 2：代码块宽度用 CSS 修复
- 预览区 `<pre>` 添加 `white-space: pre-wrap` 和 `overflow-x: auto`
- 不修改 Rust 端 PDF 导出的 CSS（PDF 中的代码块样式独立维护）

## Risks / Trade-offs

- 双向同步在两边高度差异很大时可能不够精准（与现有单向同步的问题一致）
- 代码块 `overflow-x: auto` 在内容超宽时显示水平滚动条，不影响布局
