import { marked } from 'marked';
import { resolveHtmlImages } from './image-loader.js';
import * as FileOps from './file-ops.js';

const preview = document.getElementById('preview');
let debounceTimer = null;
let updateGen = 0;          // 递增计数器，用于忽略过期更新
const DEBOUNCE_MS = 300;

marked.setOptions({ breaks: true });

export async function update(mdText) {
  const gen = ++updateGen;

  if (mdText.trim()) {
    const rawHtml = marked.parse(mdText);

    // 获取当前文件目录作为图片基准路径
    const currentFile = FileOps.getCurrentFile();
    const baseDir = currentFile ? currentFile.replace(/[/\\][^/\\]+$/, '') : null;

    // 解析相对路径图片为 data URI
    const html = baseDir ? await resolveHtmlImages(rawHtml, baseDir) : rawHtml;

    // 如果在此期间有新的更新触发，忽略本次结果
    if (gen !== updateGen) return;

    preview.innerHTML = html;
  } else {
    preview.innerHTML = '<p style="opacity:0.4;font-style:italic">预览区域 — 在左侧输入 Markdown 即可实时显示</p>';
  }
}

export function scheduleUpdate(getContentFn) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    update(getContentFn()).catch(() => {});
  }, DEBOUNCE_MS);
}
