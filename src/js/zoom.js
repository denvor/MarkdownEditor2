import * as Config from './config.js';

const ZOOM_KEY = 'zoom';
const ZOOM_STEP = 0.1;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;

let currentZoom = 1.0;

export function getZoom() {
  return currentZoom;
}

function applyZoom(level) {
  currentZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level));
  document.body.style.setProperty('--zoom', String(currentZoom));
  const el = document.getElementById('statusZoom');
  if (el) el.textContent = Math.round(currentZoom * 100) + '%';
}

export async function zoomIn() {
  applyZoom(currentZoom + ZOOM_STEP);
  await Config.set(ZOOM_KEY, currentZoom);
}

export async function zoomOut() {
  applyZoom(currentZoom - ZOOM_STEP);
  await Config.set(ZOOM_KEY, currentZoom);
}

export async function zoomReset() {
  applyZoom(1.0);
  await Config.set(ZOOM_KEY, 1.0);
}

export async function init() {
  const saved = await Config.get(ZOOM_KEY);
  applyZoom(saved ? parseFloat(saved) : 1.0);
}
