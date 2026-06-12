import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as Config from './config.js';
import * as Theme from './theme.js';
import * as Zoom from './zoom.js';
import * as Editor from './editor.js';
import * as Preview from './preview.js';
import * as Toolbar from './toolbar.js';
import * as Menu from './menu.js';
import * as StatusBar from './statusbar.js';
import * as Shortcuts from './shortcuts.js';
import * as FileOps from './file-ops.js';
import { marked } from 'marked';

// ── 未保存提示 ──────────────────────────────
async function promptSaveIfModified() {
  if (!FileOps.isModified()) return 'proceed';
  const ok = confirm('当前文件尚未保存。\n\n点击「确定」保存后继续。\n点击「取消」放弃更改。');
  if (ok) {
    await fileActions.save();
  }
  return 'proceed';
}

// ── Tauri 文件操作 ─────────────────────────
let fileActions = null;

function initTauriActions() {
    return {
      async newFile() {
        if (await promptSaveIfModified() === 'cancelled') return;
        FileOps.newFile();
        await Config.set('last_file', null);
      },
      async open() {
        if (await promptSaveIfModified() === 'cancelled') return;
        const result = await invoke('open_file_dialog');
        if (result) {
          FileOps.loadContent(result);
          await Config.set('last_file', result.path);
        }
      },
      async save() {
        const file = FileOps.getCurrentFile();
        if (file) {
          await invoke('write_file', { path: file, content: Editor.getContent() });
          FileOps.markSaved();
          await Config.set('last_file', file);
        } else {
          await this.saveAs();
        }
      },
      async saveAs() {
        const name = FileOps.getCurrentFile()
          ? FileOps.getCurrentFile().split(/[/\\]/).pop()
          : 'untitled.md';
        const path = await invoke('save_file_dialog', {
          content: Editor.getContent(),
          suggestedName: name,
        });
        if (path) {
          FileOps.setCurrentFile(path);
          FileOps.markSaved();
          await Config.set('last_file', path);
        }
      },
      async exportPdf() {
        const mdText = Editor.getContent().trim();
        if (!mdText) {
          alert('No content to export.');
          return;
        }
        const name = FileOps.getCurrentFile()
          ? FileOps.getCurrentFile().replace(/\.\w+$/, '.pdf')
          : 'output.pdf';
        const html = marked.parse(mdText);

        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'flex';
        try {
          const savedPath = await invoke('export_pdf', { html, suggestedName: name });
          if (savedPath) {
            alert('PDF saved to:\n' + savedPath);
          }
        } finally {
          overlay.style.display = 'none';
        }
      },
      async exitApp() {
        if (FileOps.isModified()) {
          const ok = confirm('当前文件尚未保存。\n\n点击「确定」保存后退出。\n点击「取消」放弃更改直接退出。');
          if (ok) await fileActions.save();
        }
        await onBeforeUnload();
        await invoke('exit_app');
      },
      showAbout() {
        alert(
          'Markdown Editor v2.0\n\n' +
          'A split-pane Markdown editor with live preview,\n' +
          'file operations, and PDF export.\n\n' +
          'Built with Tauri + Web technologies.',
        );
      },
      async closeFile() {
        if (await promptSaveIfModified() === 'cancelled') return;
        FileOps.newFile();
        await Config.set('last_file', null);
      },
      async loadPath(filePath) {
        if (await promptSaveIfModified() === 'cancelled') return;
        try {
          const result = await invoke('read_file_at_path', { path: filePath });
          FileOps.loadContent(result);
          await Config.set('last_file', result.path);
          return true;
        } catch {
          return false;
        }
      },
    };
}

// ── Demo 内容 ──────────────────────────────
const DEMO_CONTENT = [
  '# Markdown Editor v2.0',
  '',
  '欢迎使用 **Markdown Editor**！基于 Tauri 构建，界面更现代，预览更流畅。',
  '',
  '## 功能演示',
  '',
  '### 文本格式',
  '',
  '支持 **粗体**、*斜体*、~~删除线~~、`行内代码`。',
  '',
  '### 代码块',
  '',
  '```python',
  'def hello():',
  '    print("Hello, Markdown!")',
  '```',
  '',
  '### 引用',
  '',
  '> 好的代码就是它最好的文档。',
  '> — *Steve McConnell*',
  '',
  '### 列表',
  '',
  '- 无序列表项 1',
  '- 无序列表项 2',
  '  - 嵌套子项',
  '',
  '1. 有序列表第一项',
  '2. 有序列表第二项',
  '',
  '### 表格',
  '',
  '| 功能 | 状态 | 说明 |',
  '| --- | --- | --- |',
  '| 实时预览 | ✅ | 输入即渲染 |',
  '| 主题切换 | ✅ | 4 套配色 |',
  '| View 缩放 | ✅ | Ctrl+= / Ctrl+- / Ctrl+0 |',
  '| 记忆文件 | ✅ | 重启自动恢复 |',
  '| PDF 导出 | ✅ | 支持中文 |',
  '| 文件关联 | ✅ | 右键打开 |',
  '',
  '---',
  '',
  '## 快捷键',
  '',
  '| 快捷键 | 功能 |',
  '| --- | --- |',
  '| Ctrl+O | 打开文件 |',
  '| Ctrl+S | 保存 |',
  '| Ctrl+= | 放大 |',
  '| Ctrl+- | 缩小 |',
  '| Ctrl+0 | 重置缩放 |',
  '',
  '> 提示：试试切换 Theme 菜单中的主题，或在 View 菜单中缩放页面。',
  '',
  '---',
  '',
  '*此编辑器基于 Tauri + Web 技术构建，替代原有 Python + tkinter 版本。*',
].join('\n');

// ── 关闭前保存配置 ────────────────────────
async function onBeforeUnload() {
  await Config.setMultiple({
    last_file: FileOps.getCurrentFile(),
    theme: document.documentElement.className,
    zoom: Zoom.getZoom(),
  });
}

// ── 启动 ───────────────────────────────────
async function boot() {
  await Config.init();
  const cfg = Config.getAll();

  // 初始化主题和缩放
  await Theme.init();
  await Zoom.init();

  // 初始化文件操作
  fileActions = initTauriActions();

  // 初始化菜单
  Menu.init({
    newFile: () => fileActions.newFile(),
    openFile: () => fileActions.open(),
    closeFile: () => fileActions.closeFile(),
    saveFile: () => fileActions.save(),
    saveFileAs: () => fileActions.saveAs(),
    exportPdf: () => fileActions.exportPdf(),
    exitApp: () => fileActions.exitApp(),
    showAbout: () => fileActions.showAbout(),
  });

  // 初始化快捷键
  Shortcuts.init({
    new: () => fileActions.newFile(),
    open: () => fileActions.open(),
    save: () => fileActions.save(),
  });

  // 初始化工具栏
  Toolbar.init();

  // 编辑器输入 → 预览防抖 + 标题标记更新
  Editor.onInput(() => {
    Preview.scheduleUpdate(() => Editor.getContent());
    StatusBar.update();
    FileOps.refreshTitle();
  });

  // 光标移动 → 状态栏更新
  Editor.onCursorMove(() => StatusBar.update());

  // 同步滚动：编辑器滚动 → 预览按比例跟随
  const editorEl = document.getElementById('editor');
  const previewEl = document.getElementById('preview');
  editorEl.addEventListener('scroll', () => {
    const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
    const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
    if (maxEditor <= 0 || maxPreview <= 0) return;
    previewEl.scrollTop = (editorEl.scrollTop / maxEditor) * maxPreview;
  });

  // 加载内容：优先级 CLI 参数 > last_file > demo
  let loaded = false;

  try {
    const cliFile = await invoke('get_cli_file');
    if (cliFile) {
      loaded = await fileActions.loadPath(cliFile);
    }
  } catch {
    // 忽略错误
  }

  if (!loaded && cfg.last_file) {
    loaded = await fileActions.loadPath(cfg.last_file);
  }

  if (!loaded) {
    Editor.setContent(DEMO_CONTENT);
    Preview.update(DEMO_CONTENT);
    FileOps.markSaved();
  }

  // 监听第二实例传来的文件路径（双击 .md 文件）
  listen('second-instance-file', (event) => {
    fileActions.loadPath(event.payload);
  });

  StatusBar.update();

  // 关闭前保存配置 + 未保存提示
  window.addEventListener('beforeunload', (e) => {
    if (FileOps.isModified()) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
  window.addEventListener('beforeunload', onBeforeUnload);
}

document.addEventListener('DOMContentLoaded', boot);
