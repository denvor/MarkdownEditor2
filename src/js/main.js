import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { message } from '@tauri-apps/plugin-dialog';
import DOMPurify from 'dompurify';
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
import { resolveHtmlImages, inlineImages } from './image-loader.js';
import { marked } from 'marked';

// ── 未保存提示 ──────────────────────────────
const SAVE_LABEL = '保存';
const DISCARD_LABEL = '不保存';
const CANCEL_LABEL = '取消';

/**
 * 有未保存修改时弹出「保存 / 不保存 / 取消」（原生对话框）。
 * @returns {Promise<boolean>} false 表示用户取消（或保存未成功），调用方必须中止
 */
async function resolveUnsaved() {
  if (!FileOps.isModified()) return true;
  const choice = await message('当前文件尚未保存，是否保存修改？', {
    title: 'Markdown Editor',
    kind: 'warning',
    buttons: { yes: SAVE_LABEL, no: DISCARD_LABEL, cancel: CANCEL_LABEL },
  });
  if (choice === CANCEL_LABEL) return false;
  // 选「保存」时若用户在另存为对话框里取消，save() 返回 false → 中止，不能丢内容
  if (choice === SAVE_LABEL) return await fileActions.save();
  return true;
}

let quitting = false; // 关闭流程进行中：防止连点 X 叠出多个对话框

/** 未保存确认 → 落盘配置 → 关窗退出。点 X / Alt+F4 / 菜单「退出」共用此路径 */
async function quitWithPrompt() {
  if (quitting) return;
  quitting = true;
  try {
    if (!(await resolveUnsaved())) return; // 用户取消，窗口保留
    await onBeforeUnload();
    await invoke('exit_app'); // 置位 ALLOW_CLOSE 后窗口才真正关闭
  } finally {
    quitting = false;
  }
}

// ── Tauri 文件操作 ─────────────────────────
let fileActions = null;

function initTauriActions() {
    return {
      async newFile() {
        if (!(await resolveUnsaved())) return;
        FileOps.newFile();
        await Config.set('last_file', null);
      },
      async open() {
        if (!(await resolveUnsaved())) return;
        const result = await invoke('open_file_dialog');
        if (result) {
          FileOps.loadContent(result);
          await Config.set('last_file', result.path);
        }
      },
      /** @returns {Promise<boolean>} 是否确实保存成功（另存为被取消时为 false） */
      async save() {
        const file = FileOps.getCurrentFile();
        if (file) {
          await invoke('write_file', { path: file, content: Editor.getContent() });
          FileOps.markSaved();
          await Config.set('last_file', file);
          return true;
        }
        return this.saveAs();
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
        return !!path;
      },
      async exportPdf() {
        const mdText = Editor.getContent().trim();
        if (!mdText) {
          alert('No content to export.');
          return;
        }
        const name = FileOps.getCurrentFile()
          ? FileOps.getCurrentFile().split(/[/\\]/).pop().replace(/\.\w+$/, '.pdf')
          : 'output.pdf';
        const rawHtml = DOMPurify.sanitize(marked.parse(mdText));

        // 解析相对路径图片为 data URI
        const baseDir = FileOps.getBaseDir();
        const { html, images, failed } = await resolveHtmlImages(rawHtml, baseDir);
        // 占位符替换为 data URI，生成自包含 HTML（PDF 需要内联图片）
        const exportHtml = inlineImages(html, images, failed);

        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'flex';
        try {
          const savedPath = await invoke('export_pdf', { html: exportHtml, suggestedName: name });
          if (savedPath) {
            alert('PDF saved to:\n' + savedPath);
          }
        } finally {
          overlay.style.display = 'none';
        }
      },
      async exitApp() {
        // 与点 X / Alt+F4 走同一条确认路径（保存 / 不保存 / 取消）
        await quitWithPrompt();
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
        if (!(await resolveUnsaved())) return;
        FileOps.newFile();
        await Config.set('last_file', null);
      },
      async loadPath(filePath) {
        if (!(await resolveUnsaved())) return false;
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

// ── 分隔条拖动调整窗格宽度 ──────────────
function initDivider() {
  const divider = document.getElementById('divider');
  const editorPane = document.querySelector('.editor-pane');
  const previewPane = document.querySelector('.preview-pane');
  const mainArea = document.querySelector('.main-area');
  const MIN_PX = 200;

  // 把编辑区百分比钳制到「两侧都不小于 MIN_PX」的区间
  const clampPercent = (percent) => {
    const minPercent = (MIN_PX / mainArea.getBoundingClientRect().width) * 100;
    return Math.min(Math.max(percent, minPercent), 100 - minPercent);
  };

  const applySplit = (percent) => {
    editorPane.style.flexBasis = percent + '%';
    previewPane.style.flexBasis = (100 - percent) + '%';
  };

  let isDragging = false;
  let lastPercent = 50; // 本次拖动的最终比例，结束时才写配置

  // 恢复上次的位置。按当前窗口宽度重新钳制：上次存的比例在新窗口下
  // 可能让某一侧小于 MIN_PX（窗口变窄），不钳制就破坏最小宽度约束。
  const saved = Config.get('pane_ratio');
  if (typeof saved === 'number' && Number.isFinite(saved)) {
    lastPercent = clampPercent(saved);
    applySplit(lastPercent);
  }

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    divider.classList.remove('dragging');
    document.body.classList.remove('dragging');
    // 仅在拖动结束时写一次：放 pointermove 里会每次移动都 IPC + 落盘
    Config.set('pane_ratio', Math.round(lastPercent * 100) / 100).catch(() => {});
  };

  // 使用 Pointer Events + setPointerCapture：即使鼠标在窗口外松开，
  // pointerup 也会派发到分隔条上，避免 isDragging 卡死
  divider.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // 仅左键开始拖动，避免右键/中键误触发
    e.preventDefault();
    isDragging = true;
    divider.classList.add('dragging');
    document.body.classList.add('dragging');
    divider.setPointerCapture(e.pointerId);
  });

  divider.addEventListener('pointermove', (e) => {
    if (!isDragging) return;

    const rect = mainArea.getBoundingClientRect();
    lastPercent = clampPercent(((e.clientX - rect.left) / rect.width) * 100);
    applySplit(lastPercent);
  });

  divider.addEventListener('pointerup', endDrag);
  divider.addEventListener('pointercancel', endDrag);
}

// ── 关闭前保存配置 ────────────────────────
async function onBeforeUnload() {
  await Config.setMultiple({
    last_file: FileOps.getCurrentFile(),
    theme: document.documentElement.className,
    zoom: Zoom.getZoom(),
  });
}

// ── 启动 ───────────────────────────────────
async function bootInner() {
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

  // 同步滚动：左右任意一边滚动时，另一边按比例跟随。
  // scroll 事件异步派发，isSyncing 标志在事件到达前就被清除，无法阻止反馈回路。
  // 改为记录程序化设置的 scrollTop，对侧事件到达时对比位置判断是否"来自本侧"。
  // 标记加 TTL 自动清除：若程序化设置后 scrollTop 未变（无 scroll 事件），标记自动失效，
  // 避免下一次真实滚动被误判为"本侧操作"而吞掉。300ms 足够覆盖滚动事件的派发延迟。
  const editorEl = document.getElementById('editor');
  const previewEl = document.getElementById('preview');
  let lastEditorSet = null;
  let lastPreviewSet = null;
  let editorClearTimer = null;
  let previewClearTimer = null;

  const markEditorSet = (target) => {
    lastEditorSet = target;
    clearTimeout(editorClearTimer);
    editorClearTimer = setTimeout(() => { lastEditorSet = null; }, 300);
  };
  const markPreviewSet = (target) => {
    lastPreviewSet = target;
    clearTimeout(previewClearTimer);
    previewClearTimer = setTimeout(() => { lastPreviewSet = null; }, 300);
  };

  const scrollEditorToPreview = () => {
    const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
    const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
    if (maxEditor <= 0 || maxPreview <= 0) return;
    const target = (editorEl.scrollTop / maxEditor) * maxPreview;
    markPreviewSet(target);
    previewEl.scrollTop = target;
  };
  const scrollPreviewToEditor = () => {
    const maxEditor = editorEl.scrollHeight - editorEl.clientHeight;
    const maxPreview = previewEl.scrollHeight - previewEl.clientHeight;
    if (maxEditor <= 0 || maxPreview <= 0) return;
    const target = (previewEl.scrollTop / maxPreview) * maxEditor;
    markEditorSet(target);
    editorEl.scrollTop = target;
  };

  editorEl.addEventListener('scroll', () => {
    // 若该位置由本侧程序化设置触发，直接放行（消费标记，不反向同步）
    if (lastEditorSet !== null) {
      const ours = Math.abs(editorEl.scrollTop - lastEditorSet) < 1;
      lastEditorSet = null;
      if (ours) return;
    }
    scrollEditorToPreview();
  });

  previewEl.addEventListener('scroll', () => {
    if (lastPreviewSet !== null) {
      const ours = Math.abs(previewEl.scrollTop - lastPreviewSet) < 1;
      lastPreviewSet = null;
      if (ours) return;
    }
    scrollPreviewToEditor();
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
    Preview.update(DEMO_CONTENT).catch(() => {});
    FileOps.markSaved();
  }

  // 监听第二实例传来的文件路径（双击 .md 文件）
  listen('second-instance-file', (event) => {
    fileActions.loadPath(event.payload);
  });

  // 初始化分隔条拖动
  initDivider();

  StatusBar.update();

  // 原生关闭请求（点 X / Alt+F4）：Rust 端已 prevent_close，必须在此确认后才真正退出
  listen('close-requested', () => quitWithPrompt());

  // 关闭前落盘配置（主题/缩放/最近文件）。
  // 注：beforeunload 中 preventDefault 无法拦截 Tauri 原生关窗，未保存提示由上面的 close-requested 处理
  window.addEventListener('beforeunload', onBeforeUnload);
}

/**
 * 主窗口在 tauri.conf.json 中初始为 visible:false，首屏就绪后再显示，避免空白窗框。
 * 放 finally：即使启动过程抛错也必须显示窗口，否则用户只会看到一个看不见的进程。
 */
async function boot() {
  try {
    await bootInner();
  } finally {
    await getCurrentWindow().show().catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', boot);
