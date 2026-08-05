import { invoke } from '@tauri-apps/api/core';

// 图片缓存: 绝对路径 → data URI（超出上限时淘汰最旧条目，防止无限增长）
const imageCache = new Map();
const MAX_CACHE_ENTRIES = 100;

function cacheSet(key, value) {
  if (imageCache.has(key)) imageCache.delete(key);
  imageCache.set(key, value);
  while (imageCache.size > MAX_CACHE_ENTRIES) {
    imageCache.delete(imageCache.keys().next().value);
  }
}

/** 清空图片缓存（打开新文件时调用，避免磁盘图片更新后仍显示旧图） */
export function clearImageCache() {
  imageCache.clear();
}

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
    // 去掉查询串（?）和锚点（#），它们不是文件路径的一部分
    const filePath = decodedSrc.split(/[?#]/)[0];
    const absPath = normalizedBase + filePath;

    if (imageCache.has(absPath)) {
      const cached = imageCache.get(absPath);
      return cached ? `<img${attrs}src="${cached}"` : match;
    }

    tasks.push({ src, absPath });
    return match; // 暂不替换
  });

  if (tasks.length === 0) return result;

  // 第二遍：批量解析图片（成功和失败都缓存，避免每次防抖都重复读盘）
  const replacements = await Promise.all(tasks.map(async ({ src, absPath }) => {
    try {
      const dataUri = await invoke('resolve_image', { path: absPath });
      cacheSet(absPath, dataUri);
      return { src, dataUri };
    } catch {
      cacheSet(absPath, null); // 失败缓存，防止无限重试
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
