import * as Zoom from './zoom.js';

export function init(fileActions) {
  document.addEventListener('keydown', (e) => {
    const ctrl = e.ctrlKey || e.metaKey;

    if (ctrl && e.key === 's') {
      e.preventDefault();
      if (fileActions.save) fileActions.save();
    }
    if (ctrl && e.key === 'o') {
      e.preventDefault();
      if (fileActions.open) fileActions.open();
    }
    if (ctrl && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      Zoom.zoomIn();
    }
    if (ctrl && e.key === '-') {
      e.preventDefault();
      Zoom.zoomOut();
    }
    if (ctrl && e.key === '0') {
      e.preventDefault();
      Zoom.zoomReset();
    }
    if (ctrl && e.key === 'z') {
      // 浏览器原生 undo 在 textarea 中工作
    }
    if (ctrl && e.key === 'y') {
      // 浏览器原生 redo
    }
  });
}
