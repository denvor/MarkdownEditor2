## 1. HTML 结构

- [ ] 1.1 在 `index.html` 的 `editor-pane` 和 `preview-pane` 之间添加 `<div class="divider" id="divider"></div>` 元素

## 2. CSS 样式

- [ ] 2.1 在 `styles.css` 添加 `.divider` 基础样式：宽度 4px、背景色使用 `--border`、`flex-shrink: 0`、`cursor: col-resize`、`user-select: none`
- [ ] 2.2 添加 `.divider:hover` 和 `.divider.dragging` 高亮样式（背景色变亮）
- [ ] 2.3 添加 `body.dragging` 样式：`user-select: none`、`cursor: col-resize`
- [ ] 2.4 将 `.pane` 的 `flex: 1` 改为 `flex-basis: 50%`（保留 `flex-grow: 1`、`flex-shrink: 1` 以支持窗口 resize 时按比例分配）

## 3. 拖动逻辑

- [ ] 3.1 在 `main.js` 添加 `initDivider()` 函数，获取 divider、editorPane、previewPane 元素引用
- [ ] 3.2 实现 `mousedown` 事件：记录拖动状态、添加 `dragging` 类到 body 和 divider
- [ ] 3.3 实现 `mousemove` 事件：计算相对于 `.main-area` 的百分比位置，clamp 在最小/最大范围内，更新两侧 `flex-basis`
- [ ] 3.4 实现 `mouseup` 事件：移除拖动状态、移除 `dragging` 类、移除 mousemove/mouseup 监听
- [ ] 3.5 在应用启动时调用 `initDivider()`

## 4. 验证

- [ ] 4.1 运行应用，确认分隔条可见且悬停时显示 `col-resize` 光标
- [ ] 4.2 拖动分隔条，确认两侧宽度实时变化、对侧同步反向变化
- [ ] 4.3 拖到极限位置，确认每侧不小于 200px
- [ ] 4.4 拖动过程中确认文本选择被禁用
- [ ] 4.5 释放鼠标后确认分隔条停在当前位置
- [ ] 4.6 resize 窗口确认比例保持不变
