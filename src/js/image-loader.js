import { invoke } from '@tauri-apps/api/core';

// 图片缓存: 绝对路径 → data URI（超出上限时淘汰最旧条目，防止无限增长）。
// 失败时缓存记录时间戳（number），超过 FAILURE_RETRY_MS 后允许重试。
const imageCache = new Map();
const MAX_CACHE_ENTRIES = 100;
const FAILURE_RETRY_MS = 3000; // 失败 3s 后重试：既避免每次防抖都读盘，也不会让用户修好后预览迟迟不恢复

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
// 占位符前缀：只出现在 img 的 src 中，替换时不会误伤原始 HTML 里的其它 src
const PH_PREFIX = '__MDIMG_';

/**
 * 归一化路径并判断 absPath 是否仍在 baseDir 内。
 * 防止 markdown 用 ../ 逃逸到任意目录读取图片文件。
 * 同时处理正斜杠和反斜杠分隔符（Windows 路径中的 ..\..\）。
 */
function isWithinBaseDir(baseDir, absPath) {
  const base = baseDir.replace(/\\/g, '/').replace(/\/+$/, '');
  const norm = (p) => {
    const out = [];
    for (const seg of p.split(/[/\\]+/)) {
      if (seg === '' || seg === '.') continue;
      if (seg === '..') {
        if (out.length) out.pop();
      } else {
        out.push(seg);
      }
    }
    return out.join('/');
  };
  const b = norm(base);
  const a = norm(absPath);
  return a === b || a.startsWith(b + '/');
}

/**
 * 将 HTML 中相对路径的图片解析为 data URI。
 * 不内联到 HTML，而是把每个相对 src 换成唯一占位符并返回 ph→dataUri 映射，
 * 由调用方决定如何应用（预览区注入后设 img.src；PDF 导出时替换为 data URI）。
 * @param {string} html  - marked.parse() 产出的 HTML
 * @param {string} baseDir - markdown 文件所在目录
 * @returns {Promise<{html: string, images: Map<string,string>, failed: Map<string,string>}>}
 *   images: 占位符 → data URI；failed: 占位符 → 原始 src（解析失败，恢复以便调试）
 */
export async function resolveHtmlImages(html, baseDir) {
  const images = new Map();
  const failed = new Map();
  if (!baseDir) return { html, images, failed };

  const tasks = [];
  const srcByPh = new Map();
  const phByAbs = new Map(); // 同一绝对路径复用同一占位符，避免重复 IPC
  const normalizedBase = baseDir.replace(/\\/g, '/').replace(/\/?$/, '/');
  let phCounter = 0;

  // 第一遍：把每个相对图片 src 替换为唯一占位符，并收集解析任务
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

    // 路径逃逸出文档目录：不解析，保留原始 src（浏览器无法加载，天然安全）
    if (!isWithinBaseDir(normalizedBase, absPath)) {
      return match;
    }

    let ph = phByAbs.get(absPath);
    if (!ph) {
      ph = `${PH_PREFIX}${phCounter++}__`;
      phByAbs.set(absPath, ph);
      srcByPh.set(ph, src);
      tasks.push({ absPath, ph });
    }
    return `<img${attrs}src="${ph}"`;
  });

  if (tasks.length === 0) return { html: result, images, failed };

  // 第二遍：逐张解析（缓存命中直接取；未命中 IPC 读盘；成功和失败都缓存）
  const results = await Promise.all(tasks.map(async ({ absPath, ph }) => {
    const cached = imageCache.get(absPath);
    if (typeof cached === 'string') {
      return { ph, dataUri: cached }; // 缓存命中，无需 IPC
    }
    if (typeof cached === 'number') {
      // 近期失败的缓存：跳过，避免每次防抖都重试；超过 TTL 后允许重试
      if (Date.now() - cached < FAILURE_RETRY_MS) return { ph, dataUri: null };
      imageCache.delete(absPath);
    }
    try {
      const dataUri = await invoke('resolve_image', { path: absPath, baseDir: normalizedBase });
      cacheSet(absPath, dataUri);
      return { ph, dataUri };
    } catch {
      cacheSet(absPath, Date.now()); // 记录失败时间
      return { ph, dataUri: null };
    }
  }));

  for (const r of results) {
    if (r.dataUri) {
      images.set(r.ph, r.dataUri);
    } else {
      // 失败时恢复原始 src（而非占位符），便于调试且不影响非 img 元素
      failed.set(r.ph, srcByPh.get(r.ph));
    }
  }
  return { html: result, images, failed };
}

/**
 * 将 html 中的占位符替换为 data URI，产出自包含 HTML（用于 PDF 导出）。
 * 失败的占位符恢复为原始 src。
 */
export function inlineImages(html, images, failed) {
  let out = html;
  for (const [ph, dataUri] of images) {
    if (dataUri) {
      out = out.replaceAll(`src="${ph}"`, `src="${dataUri}"`);
    }
  }
  for (const [ph, orig] of failed) {
    out = out.replaceAll(`src="${ph}"`, `src="${orig}"`);
  }
  return out;
}
