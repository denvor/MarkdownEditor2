// 编辑器操作：获取/设置内容、光标插入、选中文本包裹
const editor = document.getElementById('editor');

export function getContent() {
  return editor.value;
}

export function setContent(text) {
  editor.value = text;
}

export function getSelection() {
  return {
    start: editor.selectionStart,
    end: editor.selectionEnd,
    text: editor.value.substring(editor.selectionStart, editor.selectionEnd),
  };
}

export function insertAtCursor(text, cursorOffset) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const before = editor.value.substring(0, start);
  const after = editor.value.substring(end);
  const prevScrollTop = editor.scrollTop;
  editor.value = before + text + after;
  editor.scrollTop = prevScrollTop;
  const pos = start + (cursorOffset !== undefined ? cursorOffset : text.length);
  editor.setSelectionRange(pos, pos);
  editor.focus();
}

export function wrapSelection(before, after) {
  const sel = getSelection();
  if (sel.start === sel.end) {
    insertAtCursor(before + after, before.length);
  } else {
    const text = before + sel.text + after;
    const fullBefore = editor.value.substring(0, sel.start);
    const fullAfter = editor.value.substring(sel.end);
    const prevScrollTop = editor.scrollTop;
    editor.value = fullBefore + text + fullAfter;
    editor.scrollTop = prevScrollTop;
    const newPos = sel.start + text.length;
    editor.setSelectionRange(newPos, newPos);
    editor.focus();
  }
}

export function getCursorPosition() {
  const pos = editor.selectionStart;
  const text = editor.value.substring(0, pos);
  const lines = text.split('\n');
  return {
    line: lines.length,
    col: lines[lines.length - 1].length + 1,
    currentLine: (editor.value.split('\n')[lines.length - 1] || ''),
  };
}

export function onInput(callback) {
  editor.addEventListener('input', callback);
}

export function onCursorMove(callback) {
  editor.addEventListener('click', callback);
  editor.addEventListener('keyup', callback);
}
