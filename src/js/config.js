import { invoke } from '@tauri-apps/api/core';

// 配置持久化：优先使用 Tauri Rust 后端，回退到 localStorage
let cachedConfig = {};
let saveImpl = null;
let loadImpl = null;

async function initTauriProvider() {
  try {
    // 检测 Tauri invoke 是否可用
    await invoke('load_config');
    loadImpl = async () => invoke('load_config');
    saveImpl = async (config) => {
      localStorage.setItem('md-editor-config', JSON.stringify(config));
      // window_state 完全由 Rust 端管理，JS 端不参与，避免覆盖 CloseRequested 写入的值
      const { window_state: _, ...rest } = config;
      await invoke('save_config', { config: rest });
    };
    return true;
  } catch {
    return false;
  }
}

function initLocalStorageProvider() {
  loadImpl = async () => {
    try {
      const raw = localStorage.getItem('md-editor-config');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };
  saveImpl = async (config) => {
    localStorage.setItem('md-editor-config', JSON.stringify(config));
  };
}

let readyPromise = null;

export async function init() {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    const hasTauri = await initTauriProvider();
    if (!hasTauri) {
      initLocalStorageProvider();
    }
    cachedConfig = await loadImpl();
  })();
  return readyPromise;
}

export function getAll() {
  return { ...cachedConfig };
}

export function get(key) {
  return cachedConfig[key] ?? null;
}

export async function set(key, value) {
  cachedConfig[key] = value;
  if (saveImpl) {
    await saveImpl(cachedConfig);
  }
}

export async function setMultiple(updates) {
  Object.assign(cachedConfig, updates);
  if (saveImpl) {
    await saveImpl(cachedConfig);
  }
}
