import * as Config from './config.js';
import { invoke } from '@tauri-apps/api/core';

const THEME_KEY = 'theme';

export function apply(name) {
  document.documentElement.className = name;
  document.querySelectorAll('#themeMenu .dropdown-item').forEach((item) => {
    item.style.fontWeight = item.dataset.theme === name ? 'bold' : 'normal';
  });
  // 同步原生标题栏主题
  invoke('set_window_theme', { theme: name }).catch(() => {});
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
