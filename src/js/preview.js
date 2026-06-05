import { marked } from 'marked';

const preview = document.getElementById('preview');
let debounceTimer = null;
const DEBOUNCE_MS = 300;

marked.setOptions({ breaks: true });

export function update(mdText) {
  if (mdText.trim()) {
    preview.innerHTML = marked.parse(mdText);
  } else {
    preview.innerHTML = '<p style="opacity:0.4;font-style:italic">预览区域 — 在左侧输入 Markdown 即可实时显示</p>';
  }
}

export function scheduleUpdate(getContentFn) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    update(getContentFn());
  }, DEBOUNCE_MS);
}
