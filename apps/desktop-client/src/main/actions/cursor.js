const path = require('path');
const { createDisplayWindows, destroyWindows, loadHtml } = require('./windowManager');

let cursorWins = [];
let cursorTimer = null;
let nativeCursor = null;
let nativeCursorHidden = false;

const VALID_CURSORS = ['crosshair', 'wait', 'none', 'default'];

function clearCursorOverlay() {
  if (cursorTimer) {
    clearTimeout(cursorTimer);
    cursorTimer = null;
  }
  destroyWindows(cursorWins);
  cursorWins = [];
}

function loadNativeCursor() {
  if (nativeCursor) return nativeCursor;
  nativeCursor = require(path.join(__dirname, '..', '..', 'native', 'keyboard_hook.node'));
  return nativeCursor;
}

function restoreNativeCursor() {
  if (process.platform !== 'win32' || !nativeCursorHidden) return;
  try {
    loadNativeCursor().restoreSystemCursor();
  } catch (err) {
    console.error(`[hide_cursor] native restore failed: ${err.message}`);
  }
  nativeCursorHidden = false;
}

function openCursorOverlay(cssCursor, duration) {
  clearCursorOverlay();

  cursorWins = createDisplayWindows('Cursor Overlay', {
    transparent: true,
    focusable: false,
    level: 'top',
  });

  const html =
    `<html><body style="margin:0;width:100vw;height:100vh;background:transparent;cursor:${cssCursor}"></body></html>`;

  for (const win of cursorWins) {
    loadHtml(win, html);
    win.on('closed', () => {
      cursorWins = cursorWins.filter((w) => w !== win);
    });
  }

  cursorTimer = setTimeout(clearCursorOverlay, Math.max(1, Number(duration) || 10) * 1000);
  cursorTimer.unref?.();
}

function hideCursor(duration = 10) {
  clearCursorOverlay();
  restoreNativeCursor();

  if (process.platform !== 'win32') {
    console.warn('[hide_cursor] native cursor hiding is only supported on Windows');
    return false;
  }

  try {
    const ok = loadNativeCursor().hideSystemCursor();
    if (!ok) throw new Error('SetSystemCursor failed');
    nativeCursorHidden = true;
  } catch (err) {
    console.error(`[hide_cursor] native hide failed: ${err.message}`);
    return false;
  }

  cursorTimer = setTimeout(restoreCursor, Math.max(1, Number(duration) || 10) * 1000);
  cursorTimer.unref?.();
  return true;
}

function changeCursor(type = 'default', duration = 10) {
  const cursor = VALID_CURSORS.includes(type) ? type : 'default';
  openCursorOverlay(cursor, duration);
}

function restoreCursor() {
  clearCursorOverlay();
  restoreNativeCursor();
}

module.exports = { hideCursor, changeCursor, restoreCursor };
