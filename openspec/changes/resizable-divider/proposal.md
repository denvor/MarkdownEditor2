## Why

当前编辑器窗格和预览窗格以固定 50/50 比例分割，用户无法根据需要调整两侧宽度（例如编辑长行时希望编辑区更宽，查看排版效果时希望预览区更宽）。添加可拖动的分隔条让用户自由分配空间。

## What Changes

- 在编辑窗格和预览窗格之间添加一个可见的拖动分隔条（divider）
- 支持鼠标拖动分隔条调整两侧宽度
- 拖动时显示视觉反馈（如光标变化、分隔条高亮）
- 最小宽度限制，防止某一侧被拖到不可用

## Capabilities

### New Capabilities

- `resizable-pane`: 分隔条拖动调整编辑区/预览区宽度

### Modified Capabilities

（无已有 spec 修改）

## Impact

- **文件修改**：
  - `src/index.html` — 在两个 pane 之间添加 divider 元素
  - `src/css/styles.css` — 分隔条样式 + 拖动状态样式
  - `src/js/main.js` — 拖动事件处理逻辑
- **无 Rust 端修改**
- **无依赖新增**
