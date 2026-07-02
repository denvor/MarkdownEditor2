import { invoke } from '@tauri-apps/api/core';

// 图片缓存: 绝对路径 → data URI
const imageCache = new Map();

// 匹配相对路径的 <img> 标签（排除 data:/http/https/file:/ 绝对路径/盘符开头）
const RELATIVE_IMG_RE = /<img([^>]+)src="(?!\/|[a-zA-Z]:|data:|https?:\/\/|file:\/\/)([^"]+)"/gi;

/**
 * 将 HTML 中相对路径的图片替换为 base64 data URI。
 * @param {string} html  - marked.parse() 产出的 HTML
 * @param {string} baseDir - markdown 文件所在目录
 * @returns {Promise<string>} 图片已替换的 HTML
 */
export async function resolveHtmlImages(html, baseDir) {
  if (!baseDir) return html;

  const tasks = [];
  const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/?$/, '/');

  // 第一遍：缓存命中直接替换，未命中收集任务
  const result = html.replace(RELATIVE_IMG_RE, (match, attrs, src) => {
    // marked.js 对非 ASCII 字符做了 encodeURI，需解码后才是文件系统路径
    let decodedSrc;
    try {
      decodedSrc = decodeURIComponent(src);
    } catch {
      decodedSrc = src;
    }
    const absPath = normalizedBase + decodedSrc;

    if (imageCache.has(absPath)) {
      return `<img${attrs}src="${imageCache.get(absPath)}"`;
    }

    tasks.push({ src, absPath });
    return match; // 暂不替换
  });

  if (tasks.length === 0) return result;

  // 第二遍：批量解析图片
  const replacements = await Promise.all(tasks.map(async ({ src, absPath }) => {
    try {
      const dataUri = await invoke('resolve_image', { path: absPath });
      imageCache.set(absPath, dataUri);
      return { src, dataUri };
    } catch {
      return null;
    }
  }));

  // 第三遍：将相对路径 src 替换为 data URI
  let finalHtml = result;
  for (const r of replacements) {
    if (r) {
      finalHtml = finalHtml.replaceAll(
        `src="${r.src}"`,
        `src="${r.dataUri}"`,
      );
    }
  }

  return finalHtml;
}
