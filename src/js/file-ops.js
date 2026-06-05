import { getContent, setContent } from './editor.js';
import * as Preview from './preview.js';
import * as StatusBar from './statusbar.js';

let currentFile = null;

export function getCurrentFile() {
  return currentFile;
}

export function setCurrentFile(path) {
  currentFile = path;
  updateTitle();
  StatusBar.update();
}

function updateTitle() {
  const name = currentFile ? currentFile.split(/[/\\]/).pop() : 'Untitled';
  document.title = currentFile ? `${name} — Markdown Editor` : 'Markdown Editor';
  const statusFile = document.getElementById('statusFile');
  if (statusFile) statusFile.textContent = currentFile ? name : 'Untitled';
}

export function loadContent(fileData) {
  setContent(fileData.content);
  setCurrentFile(fileData.path);
  Preview.update(fileData.content);
  StatusBar.update();
}
