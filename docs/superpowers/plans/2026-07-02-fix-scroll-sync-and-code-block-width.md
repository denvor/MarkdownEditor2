# 双向同步滚动 & 代码块宽度修复 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复两个已有问题：滚动同步从单向改为双向，修复预览区代码块显示过窄问题

**Architecture:** 
- 滚动同步：在 `main.js` 的现有单向滚动监听旁，为预览区添加同样的 `scroll` 监听，用比例公式反向同步编辑器。添加 `isSyncing` 防递归标志避免循环触发
- 代码块：修改 `styles.css` 中 `.preview-pane pre` 的 CSS，添加 `white-space: pre-wrap` 让长行自动换行，确保代码完整显示

**Tech Stack:** 纯前端修改（CSS + JS），不涉及 Rust 后端

---

### Task 1: 添加双向滚动同步

**Files:**
- Modify: `src/js/main.js:246-254`
- Test: 手动验证（打开含冗长正文的文件，滚动左侧→右侧跟随，滚动右侧→左侧跟随）

- [ ] **Step 1: 修改滚动同步代码为双向**

将 `main.js:246-254` 的单向监听改为双向，添加 `isSyncing` 防递归标志：

```js
  // 同步滚动：左右任意一边滚动时，另一边按比例跟随
  const editorEl = document.getElementById('editor');
  const previewEl = document.getElementById('preview');
  let isSyncing = false;

  editorEl.addEventListener('scroll', () => {
    if (isSyncing) return;
    isSyncing = true;
    const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
    const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
    if (maxEditor > 0 && maxPreview > 0) {
      previewEl.scrollTop = (editorEl.scrollTop / maxEditor) * maxPreview;
    }
    isSyncing = false;
  });

  previewEl.addEventListener('scroll', () => {
    if (isSyncing) return;
    isSyncing = true;
    const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
    const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
    if (maxEditor > 0 && maxPreview > 0) {
      editorEl.scrollTop = (previewEl.scrollTop / maxPreview) * maxEditor;
    }
    isSyncing = false;
  });
```

- [ ] **Step 2: 构建并验证**

Run: `npx tauri build`

手动验证：
- 打开长文档
- 滚动编辑器（左）→ 预览（右）跟随
- 滚动预览（右）→ 编辑器（左）跟随
- 快速连续滚动 → 无卡死或跳转

- [ ] **Step 3: 提交**

```bash
git add src/js/main.js
git commit -m "fix: 双向同步滚动 — 右窗滚动时左窗按比例跟随"
```

---

### Task 2: 修复代码块宽度

**Files:**
- Modify: `src/css/styles.css:127`
- Test: 打开含长行代码的 `.md` 文件，预览区代码完整显示

- [ ] **Step 1: 修改 `.preview-pane pre` CSS**

当前第 127 行：
```css
.preview-pane pre { padding: 14px; border-radius: 6px; overflow-x: auto; margin: 10px 0; }
```

改为：
```css
.preview-pane pre { padding: 14px; border-radius: 6px; overflow-x: auto; margin: 10px 0; white-space: pre-wrap; word-break: break-all; }
```

添加 `white-space: pre-wrap` 让长行自动换行，`word-break: break-all` 避免极长单词溢出。

- [ ] **Step 2: 构建并验证**

Run: `npx tauri build`

手动验证：
- 打开含 ` ``` ` 代码块的 md 文件，代码行在预览区完整显示（无截断）
- 正常正文段落不受影响

- [ ] **Step 3: 提交**

```bash
git add src/css/styles.css
git commit -m "fix: 预览区代码块 white-space: pre-wrap 避免长行截断"
```

---

### Task 3: 构建最终 EXE 并验证回归

- [ ] **Step 1: 完整构建**

```bash
npx tauri build
```

- [ ] **Step 2: 回归验证清单**
- 滚动同步：左→右，右→左均正常工作
- 代码块：长行代码完整显示（换行而非截断）
- 图片显示：原功能无退化
- PDF 导出：代码块在 PDF 中渲染正常
- 主题切换：Light/Dark/Solarized Light/Solarized Dark 下的代码块配色正确

---

### Task 4: 更新 CHANGELOG

- [ ] **Step 1: 添加 v2.1.2 变更日志**

在 CHANGELOG.md 中 `## [2.1.1]` 上方插入：

```markdown
## [2.1.2] — 2026-07-02

### Fixed
- **双向同步滚动** — 预览区滚动时，编辑器按比例跟随，不再单向
- **代码块宽度** — 预览区 `<pre>` 添加 `white-space: pre-wrap`，长行代码自动换行不再截断

### Changed
- **CSS 微调** — `.preview-pane pre` 添加 `word-break: break-all` 防止极长单词溢出
```

- [ ] **Step 2: 提交**

```bash
git add CHANGELOG.md
git commit -m "docs: v2.1.2 双向滚动同步 + 代码块宽度修复"
```
