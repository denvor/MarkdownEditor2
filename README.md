# Markdown Editor

一个简洁的分屏 Markdown 编辑器，左侧编辑、右侧实时预览，支持 PDF 导出和多主题切换。

## 功能

- **分屏编辑** — 左侧源码编辑，右侧实时 HTML 预览
- **工具栏快捷插入** — 标题、粗体、斜体、删除线、引用、列表、链接、图片、代码、表格、分割线
- **4 套主题** — Light / Dark / Solarized Light / Solarized Dark
- **缩放显示** — View 菜单或 Ctrl+= / Ctrl+- / Ctrl+0，50%~200%，缩放比例自动记忆
- **记忆上次文件** — 关闭后重新打开，自动恢复上次编辑的文件
- **PDF 导出** — 支持中文，保留标题、引用、代码块、表格等结构
- **状态栏** — 显示文件名、行列号、当前行元素类型、缩放比例
- **Windows 右键关联** — 支持"打开方式"选择本程序打开 .md 文件
- **便携配置** — 主题、窗口状态、缩放比例、最近目录自动保存到 exe 同目录的 `config.json`

## 使用方式

### 直接运行

```bash
pip install markdown tkinterweb reportlab
python md_editor.py
```

### 通过 exe 运行

下载 `dist/MarkdownEditor.exe`，双击运行。

**关联 .md 文件：** 右键任意 .md 文件 → 打开方式 → 选择其他应用 → 浏览 → 选择 `MarkdownEditor.exe` → 始终使用此应用打开。

### 键盘快捷键

| 快捷键 | 功能 |
|---|---|
| Ctrl+O | 打开文件 |
| Ctrl+S | 保存 |
| Ctrl+Z | 撤销 |
| Ctrl+Y | 重做 |
| Ctrl+= | 放大 |
| Ctrl+- | 缩小 |
| Ctrl+0 | 重置缩放 |

## 自行打包

```bash
pip install pyinstaller markdown tkinterweb reportlab

python -m PyInstaller --onefile --windowed \
    --name MarkdownEditor \
    --exclude-module numpy \
    md_editor.py
```

打包产物在 `dist/MarkdownEditor.exe`（约 23.5 MB）。

## 技术栈

Python + tkinter + markdown + tkinterweb + reportlab

## 许可

MIT
