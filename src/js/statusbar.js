import { getCursorPosition } from './editor.js';

export function update() {
  const { line, col, currentLine } = getCursorPosition();
  const statusInfo = document.getElementById('statusInfo');
  if (!statusInfo) return;

  let info = `Ln ${line}, Col ${col}`;
  const stripped = currentLine.trim();

  if (/^#{1,6}\s/.test(stripped)) {
    const level = stripped.match(/^(#+)/)[1].length;
    info += `  |  Heading ${level}`;
  } else if (/^[-*_]{3,}\s*$/.test(stripped)) {
    info += '  |  Horizontal rule';
  } else if (/^>/.test(stripped)) {
    info += '  |  Blockquote';
  } else if (/^[-*]\s/.test(stripped) || /^\d+\.\s/.test(stripped)) {
    info += '  |  List item';
  } else if (/^```/.test(stripped)) {
    info += '  |  Code block';
  } else if (/^\|/.test(stripped)) {
    info += '  |  Table';
  }

  statusInfo.textContent = info;
}
