# Resizable Divider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在编辑区和预览区之间添加可拖动的分隔条，让用户自由调整两侧宽度比例。

**Architecture:** 在两个 pane 之间插入一个 4px 宽的 divider 元素。将 pane 的 `flex: 1` 改为百分比 `flex-basis`，拖动时根据鼠标位置计算百分比并更新两侧 `flex-basis`。使用 `mousedown`/`mousemove`/`mouseup` 事件模式，clamp 限制每侧最小 200px。

**Tech Stack:** 纯 CSS + vanilla JS，无新依赖。

---

### Task 1: HTML — 添加 divider 元素

**Files:**
- Modify: `index.html:92-93`

- [ ] **Step 1: 在 editor-pane 和 preview-pane 之间添加 divider**

将：
```html
  </div>
  <div class="pane preview-pane" id="preview"></div>
```

改为：
```html
  </div>
  <div class="divider" id="divider"></div>
  <div class="pane preview-pane" id="preview"></div>
```

---

### Task 2: CSS — divider 样式 + pane 布局调整

**Files:**
- Modify: `src/css/styles.css`

- [ ] **Step 1: 添加 divider 基础样式**

在 `.editor-pane { border-right: 1px solid; }` 之后（约第 102 行）添加：

```css
.divider {
  width: 4px;
  flex-shrink: 0;
  background: var(--border);
  cursor: col-resize;
  user-select: none;
  transition: background 0.15s;
}
.divider:hover {
  background: var(--fg);
  opacity: 0.4;
}
.divider.dragging {
  background: var(--fg);
  opacity: 0.6;
}
```

- [ ] **Step 2: 添加 body.dragging 样式**

在 `.divider.dragging` 规则之后添加：

```css
body.dragging {
  user-select: none;
  cursor: col-resize;
}
```

- [ ] **Step 3: 修改 pane 布局为百分比 flex-basis**

将第 88-93 行的 `.pane` 规则：

```css
.pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

改为：

```css
.pane {
  flex: 1 1 50%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

（`flex: 1 1 50%` = flex-grow:1, flex-shrink:1, flex-basis:50%。这样窗口 resize 时按比例分配，拖动时直接改 flex-basis。）

- [ ] **Step 4: 移除 editor-pane 的 border-right**

将第 102 行的：
```css
.editor-pane { border-right: 1px solid; }
```

改为：
```css
.editor-pane { }
```

或直接删除此行（border 已由 divider 替代）。

---

### Task 3: JS — 拖动逻辑

**Files:**
- Modify: `src/js/main.js`

- [ ] **Step 1: 添加 initDivider 函数**

在 `boot()` 函数之前（约第 201 行，`// ── 关闭前保存配置 ──` 之前）添加：

```js
// ── 分隔条拖动调整窗格宽度 ──────────────
function initDivider() {
  const divider = document.getElementById('divider');
  const editorPane = document.querySelector('.editor-pane');
  const previewPane = document.querySelector('.preview-pane');
  const mainArea = document.querySelector('.main-area');
  const MIN_PX = 200;

  let isDragging = false;

  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    isDragging = true;
    divider.classList.add('dragging');
    document.body.classList.add('dragging');
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const rect = mainArea.getBoundingClientRect();
    const percent = ((e.clientX - rect.left) / rect.width) * 100;
    const minPercent = (MIN_PX / rect.width) * 100;
    const clamped = Math.min(Math.max(percent, minPercent), 100 - minPercent);

    editorPane.style.flexBasis = clamped + '%';
    previewPane.style.flexBasis = (100 - clamped) + '%';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove('dragging');
    document.body.classList.remove('dragging');
  });
}
```

- [ ] **Step 2: 在 boot() 中调用 initDivider**

在 `boot()` 函数内，`StatusBar.update();` 之前（约第 304 行）添加：

```js
  // 初始化分隔条拖动
  initDivider();
```

---

### Task 4: 验证

- [ ] **Step 1: 运行应用确认分隔条可见**

运行 `npm run tauri dev` 或 `cargo tauri dev`，确认编辑区和预览区之间显示 4px 分隔条。

- [ ] **Step 2: 确认悬停光标变化**

鼠标悬停在分隔条上，确认光标变为 `col-resize`（↔）。

- [ ] **Step 3: 确认拖动功能**

拖动分隔条，确认：
- 编辑区变宽时预览区变窄，反之亦然
- 两侧总宽度不变
- 拖动过程中分隔条高亮

- [ ] **Step 4: 确认最小宽度限制**

将分隔条拖到极限，确认每侧不小于 200px。

- [ ] **Step 5: 确认窗口 resize 保持比例**

调整窗口大小，确认两侧按比例缩放而非重置为 50/50。

- [ ] **Step 6: 确认拖动时文本选择被禁用**

拖动过程中尝试选中文字，确认无法选中。

- [ ] **Step 7: 确认释放后状态保持**

释放鼠标后，分隔条恢复普通样式，两侧宽度保持不变。
