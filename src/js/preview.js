import { marked } from 'marked';
import DOMPurify from 'dompurify';
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
    // 消毒标记输出的 HTML：剥离 <script> / on* 事件 / javascript: URL，
    // 防止恶意 .md 在预览区执行脚本（marked 默认透传原始 HTML）
    const rawHtml = DOMPurify.sanitize(marked.parse(mdText));

    // 获取当前文件目录作为图片基准路径
    const baseDir = FileOps.getBaseDir();

    // 解析相对路径图片为 data URI（HTML 中只留占位符，避免内联大段 base64）
    const { html, images, failed } = await resolveHtmlImages(rawHtml, baseDir);

    // 如果在此期间有新的更新触发，忽略本次结果
    if (gen !== updateGen) return;

    preview.innerHTML = html;
    // 占位符 src 渲染为实际 data URI（同一 data URI 命中浏览器图片缓存，不重复解码）；
    // 同一图片多次出现时占位符相同，需用 querySelectorAll 全部更新
    for (const [ph, dataUri] of images) {
      preview.querySelectorAll(`img[src="${ph}"]`).forEach((img) => {
        img.src = dataUri;
      });
    }
    // 解析失败的图片恢复原始 src，便于定位问题
    for (const [ph, orig] of failed) {
      preview.querySelectorAll(`img[src="${ph}"]`).forEach((img) => {
        img.src = orig;
      });
    }
  } else {
    preview.innerHTML = '<p style="opacity:0.4;font-style:italic">预览区域 — 在左侧输入 Markdown 即可实时显示</p>';
  }
}

export function scheduleUpdate(getContentFn) {
  clearTimeout(debounceTimer);
  updateGen++; // 使在途的旧更新失效，防止慢解析写回过期内容
  debounceTimer = setTimeout(() => {
    update(getContentFn()).catch(() => {});
  }, DEBOUNCE_MS);
}
