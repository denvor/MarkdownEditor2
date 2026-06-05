# Markdown Editor

一个基于 Tauri 2.x 构建的现代分屏 Markdown 编辑器，左侧编辑、右侧实时预览，支持 PDF 导出和多主题切换。

> 替代原有 Python + tkinter 版本，界面更现代，预览更流畅。

## 功能

- **分屏编辑** — 左侧源码编辑，右侧实时 HTML 预览（marked.js 渲染）
- **工具栏快捷插入** — 标题、粗体、斜体、删除线、引用、列表、链接、图片、代码、表格、分割线
- **4 套主题** — Light / Dark / Solarized Light / Solarized Dark，Windows 标题栏颜色同步
- **缩放显示** — View 菜单或 Ctrl+= / Ctrl+- / Ctrl+0，50%~200%，缩放比例自动记忆
- **记忆上次文件** — 关闭后重新打开，自动恢复上次编辑的文件
- **PDF 导出** — 基于 WebView2 PrintToPdf，支持中文，保留标题、引用、代码块、表格等结构
- **状态栏** — 显示文件名、行列号、当前行元素类型、缩放比例
- **Windows 右键关联** — 支持"打开方式"选择本程序打开 .md 文件
- **单实例运行** — 重复启动自动聚焦已有窗口
- **便携配置** — 主题、窗口状态、缩放比例、最近目录自动保存到系统配置目录

## 使用方式

### 开发运行

```bash
npm install
npx tauri dev
```

### 打包发布

```bash
npx tauri build
```

产物位于 `src-tauri/target/release/bundle/`。

### 下载 exe

在 [GitHub Releases](https://github.com/denvor/MarkdownEditor2/releases) 页面下载最新版本的 `MarkdownEditor.exe`，双击运行。

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

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Tauri 2.x (Rust + WebView2) |
| 前端 | 原生 HTML / CSS / JavaScript ES Module |
| Markdown 解析 | marked.js |
| 后端 | Rust + serde + tauri-plugin-dialog + tauri-plugin-single-instance |
| PDF 导出 | WebView2 PrintToPdf COM API (Windows) |
| 构建工具 | Vite |
| 打包 | Tauri bundler (~10MB) |

## 许可

MIT
