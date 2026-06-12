import * as Zoom from './zoom.js';

export function init(actions) {
  // 菜单下拉切换
  document.getElementById('menubar').addEventListener('click', (e) => {
    const item = e.target.closest('.menu-item');
    if (!item) return;
    document.querySelectorAll('.menu-item').forEach((m) => {
      if (m !== item) m.classList.remove('active');
    });
    item.classList.toggle('active');
  });

  // 点击外部关闭菜单
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.menu-item')) {
      document.querySelectorAll('.menu-item').forEach((m) => m.classList.remove('active'));
    }
  });

  // 菜单项动作
  document.querySelectorAll('.dropdown-item').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const action = el.dataset.action;
        // 主题菜单项完全由 theme.js 处理
        if (!action) {
          el.closest('.menu-item')?.classList.remove('active');
          return;
        }

      switch (action) {
        case 'new':
          if (actions.newFile) await actions.newFile();
          break;
        case 'open':
          if (actions.openFile) await actions.openFile();
          break;
        case 'close':
          if (actions.closeFile) await actions.closeFile();
          break;
        case 'save':
          if (actions.saveFile) await actions.saveFile();
          break;
        case 'saveas':
          if (actions.saveFileAs) await actions.saveFileAs();
          break;
        case 'export':
          if (actions.exportPdf) await actions.exportPdf();
          break;
        case 'exit':
          if (actions.exitApp) await actions.exitApp();
          break;
        case 'undo':
          document.execCommand('undo');
          break;
        case 'redo':
          document.execCommand('redo');
          break;
        case 'zoom-in':
          Zoom.zoomIn();
          break;
        case 'zoom-out':
          Zoom.zoomOut();
          break;
        case 'zoom-reset':
          Zoom.zoomReset();
          break;
        case 'about':
          if (actions.showAbout) actions.showAbout();
          break;
      }

      el.closest('.menu-item')?.classList.remove('active');
    });
  });
}
