import { insertAtCursor, wrapSelection, getSelection, getContent } from './editor.js';
import * as Preview from './preview.js';
import * as StatusBar from './statusbar.js';

// 格式定义：{ html属性值, 前缀标记, 后缀标记, 占位符文本 }
const FORMATS = {
  '**粗体**':        { before: '**', after: '**', placeholder: '粗体' },
  '*斜体*':          { before: '*',  after: '*',  placeholder: '斜体' },
  '~~删除线~~':      { before: '~~', after: '~~', placeholder: '删除线' },
  '`代码`':          { before: '`',  after: '`',  placeholder: '代码' },
};

export function init() {
  document.querySelectorAll('.toolbar button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const raw = btn.dataset.insert;
      if (!raw) return;

      const text = raw.replace(/&#10;/g, '\n');
      const fmt = FORMATS[raw];

      if (fmt) {
        const sel = getSelection();
        if (sel.start === sel.end) {
          insertAtCursor(fmt.before + fmt.placeholder + fmt.after, fmt.before.length + fmt.placeholder.length);
        } else {
          wrapSelection(fmt.before, fmt.after);
        }
      } else {
        insertAtCursor(text);
      }

      Preview.update(getContent());
      StatusBar.update();
    });
  });
}
