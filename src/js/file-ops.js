import { getContent, setContent } from './editor.js';
import * as Preview from './preview.js';
import * as StatusBar from './statusbar.js';

let currentFile = null;
let savedContent = '';   // 最后保存/打开时的内容快照

export function getCurrentFile() {
  return currentFile;
}

export function setCurrentFile(path) {
  currentFile = path;
  updateTitle();
  StatusBar.update();
}

/** 当前内容与保存的快照是否不同 */
export function isModified() {
  return getContent() !== savedContent;
}

/** 将当前内容标记为"已保存" */
export function markSaved() {
  savedContent = getContent();
}

function updateTitle() {
  const name = currentFile ? currentFile.split(/[/\\]/).pop() : 'Untitled';
  const modified = isModified() ? ' ●' : '';
  document.title = name + modified + ' — Markdown Editor';
  const statusFile = document.getElementById('statusFile');
  if (statusFile) statusFile.textContent = (currentFile ? name : 'Untitled') + modified;
}

export function loadContent(fileData) {
  setContent(fileData.content);
  savedContent = fileData.content;
  setCurrentFile(fileData.path);
  Preview.update(fileData.content);
  StatusBar.update();
}

/** 新建空白文件 */
export function newFile() {
  currentFile = null;
  savedContent = '';
  setContent('');
  Preview.update('');
  updateTitle();
  StatusBar.update();
}

/** 刷新标题栏和状态栏的 modified 标记（输入内容变化时调用） */
export function refreshTitle() {
  updateTitle();
}
