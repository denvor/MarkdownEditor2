import * as Config from './config.js';
import { invoke } from '@tauri-apps/api/core';

const THEME_KEY = 'theme';

// 与 styles.css 中定义 CSS 变量的主题类一一对应
const THEMES = ['light', 'dark', 'solarized-light', 'solarized-dark'];

export function apply(name) {
  // 兜底未知主题名：CSS 变量只定义在上面四个类下，且 var(--bg) 无默认值，
  // 配错（旧版残留、手写错）会导致整页无样式，宁可退回 dark
  const theme = THEMES.includes(name) ? name : 'dark';
  document.documentElement.className = theme;
  document.querySelectorAll('#themeMenu .dropdown-item').forEach((item) => {
    item.style.fontWeight = item.dataset.theme === theme ? 'bold' : 'normal';
  });
  // 同步原生标题栏主题
  invoke('set_window_theme', { theme }).catch(() => {});
}

export async function init() {
  const saved = await Config.get(THEME_KEY);
  const initial = saved || 'dark';
  apply(initial);

  // 点击主题菜单项
  document.querySelectorAll('#themeMenu .dropdown-item').forEach((item) => {
    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      const name = item.dataset.theme;
      if (name) {
        apply(name);
        await Config.set(THEME_KEY, name);
        item.closest('.menu-item')?.classList.remove('active');
      }
    });
  });
}
