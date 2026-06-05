# Markdown Editor — 从零实现计划

## 概述

用 Python + tkinter 构建一个分屏 Markdown 编辑器，左侧编辑、右侧实时预览，支持文件读写、PDF 导出、多主题切换、工具栏快捷插入，以及 Windows 右键"打开方式"关联。

## 技术栈

| 依赖 | 用途 |
|---|---|
| `tkinter` | 内置 GUI 框架 |
| `markdown` | Markdown → HTML 转换 |
| `tkinterweb` | 基于 tkhtml 的 HTML 渲染组件（预览面板） |
| `reportlab` | PDF 生成（段落、标题、引用、代码块、分割线） |
| `PIL/Pillow` | reportlab 的间接依赖 |
| `PyInstaller` | 打包为独立 exe |

## 实现步骤

### 1. 项目骨架 (~30 行)

```python
import sys
import tkinter as tk

class MarkdownEditor:
    def __init__(self, root, file_path=None):
        self.root = root
        self.root.title("Markdown Editor")
        self.root.minsize(600, 400)
        self.current_file = None
        self._build_ui()
        if file_path:
            self.root.after(100, lambda: self._open_path(file_path))

if __name__ == "__main__":
    file_path = sys.argv[1] if len(sys.argv) > 1 else None
    root = tk.Tk()
    app = MarkdownEditor(root, file_path=file_path)
    root.mainloop()
```

**要点：**
- `file_path` 参数支持 Windows 右键"打开方式"传参（`sys.argv[1]`）
- `root.after(100, ...)` 延迟到 UI 初始化完成后打开文件

### 2. 菜单栏 (~30 行)

在 `_build_ui()` 中构建，结构如下：

- **File**: Open (Ctrl+O) / Save (Ctrl+S) / Save As / 分隔线 / Export PDF / 分隔线 / Exit
- **Edit**: Undo (Ctrl+Z) / Redo (Ctrl+Y)
- **View**: Zoom In (Ctrl+=) / Zoom Out (Ctrl+-) / Reset Zoom (Ctrl+0)
- **Theme**: 4 个主题的 radio button 组
- **Help**: About 对话框

键盘快捷键通过 `root.bind("<Control-o>", ...)` 绑定。

### 3. 编辑区 (~15 行)

使用 `tkinter.scrolledtext.ScrolledText`，等宽字体 Consolas 11pt，启用内置 undo/redo：

```python
self.editor = scrolledtext.ScrolledText(
    left_frame, wrap="word", font=("Consolas", 11),
    undo=True, padx=8, pady=8,
)
self.editor.bind("<KeyRelease>", self._on_text_change)
```

编辑区放入 `ttk.PanedWindow` 左半部分。

### 4. 实时预览 (~60 行)

**渲染流程：** 编辑器文本 → `markdown.markdown()` 转为 HTML body → 嵌入完整 HTML 页面（含内联 CSS） → `HtmlFrame.load_html()` 渲染。

**关键实现细节：**
- 用 **防抖 (debounce)** 避免频繁渲染：`KeyRelease` 事件触发后台线程，等 300ms 无新输入后再更新预览
- 用 `threading.Lock` 防止并发更新
- `_render_html()` 方法根据当前主题注入不同的 CSS 颜色变量
- Markdown 扩展：`tables`, `fenced_code`, `toc`, `attr_list`

```python
def _on_text_change(self, event=None):
    with self._preview_lock:
        if self._preview_pending:
            return
        self._preview_pending = True
    threading.Thread(target=self._debounced_update, daemon=True).start()
```

### 5. 工具栏 (~50 行)

单行工具栏，每个按钮插入对应 Markdown 语法到光标位置：

| 按钮 | 插入内容 | 按钮 | 插入内容 |
|---|---|---|---|
| H₁~H₆ | `# ` ~ `###### ` | ❝ | `> ` |
| **B** | `**粗体**` | • | `- ` |
| *I* | `*斜体*` | 1. | `1. ` |
| S̶ | `~~删除线~~` | 🔗 | `[链接](url)` |
| 🖼 | `![图片](src)` | <> | `` `代码` `` |
| { } | 代码块 | ⊞ | 表格模板 |
| — | `---` 分割线 | | |

光标定位技巧：插入含占位符的文本后，用 `editor.mark_set("insert", ...)` 将光标移到占位符中间。

### 6. 状态栏 (~30 行)

底部固定高度 22px 的 Frame，左侧显示文件名，右侧显示行列号和当前行元素类型：

```python
# 检测当前行类型
if re.match(r"^#{1,6}\s", stripped):   → "Heading N"
elif stripped.startswith(">"):          → "Blockquote"
elif stripped.startswith("- "):         → "List item"
elif stripped.startswith("```"):        → "Code block"
elif stripped.startswith("|"):          → "Table"
```

`<ButtonRelease-1>` 和 `<KeyRelease>` 事件触发状态更新。

### 7. 缩放功能 (~30 行)

View 菜单提供 Zoom In / Zoom Out / Reset Zoom，步长 10%，范围 50%~200%。

**编辑器缩放：** 动态修改 `ScrolledText` 的 `font` 属性：
```python
_BASE_FONT = ("Consolas", 11)

def _apply_zoom(self, level):
    size = max(1, int(self._BASE_FONT[1] * level))
    self.editor.configure(font=(self._BASE_FONT[0], size))
```

**预览缩放：** 在生成预览 HTML 时注入 `font-size: {百分比}%` 到 body 样式中。不能用 CSS `zoom` 属性——tkinterweb 的 Tkhtml 引擎不支持。

**持久化：** 缩放比例存入 `config.json` 的 `zoom` 字段，启动时恢复。状态栏右侧显示当前百分比。

**快捷键：** `<Control-equal>` / `<Control-minus>` / `<Control-0>`（tkinter 中 `Ctrl+=` 绑定为 `<Control-equal>`）。

### 8. 主题系统 (~50 行)

4 套配色方案，定义为字典 `THEMES`，每套包含：编辑器前景/背景/光标色、工具栏背景、状态栏配色、预览区配色。

`_apply_theme(name)` 方法：
1. 设置编辑区 `bg/fg/insertbackground`
2. 设置工具栏和状态栏各组件颜色
3. 触发预览重新渲染（因为 HTML 内联了主题 CSS）
4. 将主题名持久化到 `config.json`

用 `_applying_theme` 标志位防止递归触发。

### 9. 配置文件持久化 (~50 行)

`config.json` 放在 exe 同级目录（便携模式）：

```python
@staticmethod
def _config_path():
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent / "config.json"
    return Path(__file__).parent / "config.json"
```

存储内容：
- `theme`: 当前主题名称
- `last_dir`: 上次打开文件的目录
- `last_file`: 上次关闭时打开的文件路径，下次启动自动恢复
- `zoom`: 缩放比例（浮点数，默认 1.0）
- `window_state`: 窗口状态（`maximized` / `iconic` / `geometry:WxH+X+Y`）

启动时恢复窗口状态，关闭时保存。

### 10. 文件操作 (~60 行)

```
open_file() → 对话框选文件 → _open_path(path)
save_file() → 有路径直接写 / 无路径调 save_as_file()
save_as_file() → 对话框选路径 → _write_file(path)
```

`_open_path(path)` 是核心：
1. `open(path, encoding="utf-8")` 读内容
2. 设置 `self.current_file`
3. 更新 `_last_dir` 并持久化
4. 清空编辑器 → 插入内容 → 更新标题和预览

标题栏格式：`{文件名} — Markdown Editor`

**自动恢复上次文件：** 关闭时 `_on_closing()` 将 `self.current_file` 保存到 config 的 `last_file`。启动时若无命令行参数且 `last_file` 指向的文件仍存在，则自动打开。

### 11. PDF 导出 (~150 行)

**中文字体处理：**
- 启动时从 `C:\Windows\Fonts` 查找 `msyh.ttc`（微软雅黑）、`simhei.ttf`（黑体）、`simsun.ttc`（宋体）
- 用 `reportlab.pdfbase.ttfonts.TTFont` 注册为 `"Chinese"` 字体
- 所有 ParagraphStyle 指定 `fontName="Chinese"`

**HTML 安全处理 (`_inline_md`)：**
reportlab 的 Paragraph 使用 HTML 解析器，需要：
- 转义 `&` `<` `>` 为实体
- **关键坑：** `#` 被 reportlab 视为 HTML 注释起始符，必须转义为 `&#35;`
- 将 Markdown 内联语法（`**粗体**`、`*斜体*`、`` `代码` ``）转为对应 HTML 标签

**解析流程：**
1. 逐行解析 markdown，识别标题（`#`）、代码块（`` ``` ``）、引用（`>`）、分割线（`---`）、空行
2. 构建 reportlab `platypus` 元素列表：`Paragraph`, `Spacer`, `HRFlowable`, `Table`
3. 非特殊行的内联 markdown 经 `_inline_md()` 转换后用 `Paragraph` 渲染
4. PDF 生成在**后台线程**执行，避免阻塞 UI；完成后用 `root.after(0, ...)` 切回主线程弹窗

### 12. ToolTip 组件 (~20 行)

独立的 `ToolTip` 类，绑定 `<Enter>` 和 `<Leave>` 事件，显示黄色浮层提示：

```python
class ToolTip:
    def __init__(self, widget, text):
        widget.bind("<Enter>", self._show)
        widget.bind("<Leave>", self._hide)
```

### 13. 打包为 exe

```bash
pip install pyinstaller markdown tkinterweb reportlab

python -m PyInstaller --onefile --windowed \
    --name MarkdownEditor \
    --exclude-module numpy \
    md_editor.py
```

**要点：**
- `--windowed` 隐藏控制台窗口
- `--exclude-module numpy` 排除 reportlab 的可选依赖，减少 ~11MB（34MB → 23MB）
- numpy 不影响 PDF 导出功能（基础排版不需要它）

**验证清单：**
- [ ] 编辑器基本编辑、预览功能
- [ ] 所有工具栏按钮插入正常
- [ ] 4 个主题切换正常
- [ ] View 菜单缩放功能（Ctrl+= / Ctrl+- / Ctrl+0），缩放比例持久化
- [ ] 预览区随缩放同步变化
- [ ] 文件打开/保存/另存为
- [ ] 关闭后重新打开，自动恢复上次编辑的文件
- [ ] Windows 右键"打开方式"加载文件
- [ ] PDF 导出含中文内容
- [ ] 窗口状态（大小、位置、最大化）重启恢复
- [ ] 配置持久化到 exe 同目录 `config.json`

## 文件结构

```
mdTools/
├── md_editor.py       # 全部源码（单文件 ~800 行）
├── config.json         # 运行时生成，持久化用户配置
├── CLAUDE.md           # AI 辅助开发行为规范
├── plan.md             # 本文件
├── README.md           # 用户文档
├── prototype/          # HTML 产品原型
│   ├── index.html
│   └── marked.min.js
└── dist/
    └── MarkdownEditor.exe   # 打包产物 (~24 MB)

## 设计决策

| 决策 | 理由 |
|---|---|
| 单文件架构 | 避免 tkinter 跨模块导入的复杂性，方便 PyInstaller 打包 |
| `tkinterweb.HtmlFrame` 而非 `tkhtmlview` | 功能更完整，维护活跃 |
| reportlab 而非 weasyprint | 纯 Python 依赖，PyInstaller 打包更简单 |
| 自写 Markdown→PDF 解析器 | reportlab 的 HTML 支持有限，需手动逐行解析 |
| 便携式配置（exe 同目录） | 方便 U 盘携带，无需写入 AppData |
| `--onedir` 未采用 | 虽然启动更快，但 `--onefile` 单文件分发更简洁；压缩后体积与 onedir 相当 |
