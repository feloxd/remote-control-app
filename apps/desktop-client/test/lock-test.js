// Dev harness to validate the system-wide keyboard block on a TEST machine
// without wiring up the server/dashboard/socket. Engages the real lock for a
// short, self-releasing window so you can never get stuck.
//
// Run (from apps/desktop-client):
//   npm run test:lock              full path: native hook + overlay + uiohook
//   npm run test:lock:native       native WH_KEYBOARD_LL addon ONLY (no overlay)
//
// Env:
//   LOCK_SECONDS=8   how long to hold the lock (clamped to 3..50, < 60s failsafe)
//
// Safety layers (any one frees the keyboard):
//   1. Auto-unlock after LOCK_SECONDS.
//   2. keyboard.js' own 60s failsafe (full mode).
//   3. A hard process.exit watchdog at LOCK_SECONDS + 10s (killing the process
//      drops the OS hook, so even a wedged unlock can't leave you locked).
//   4. Ctrl+Alt+Del is never blockable by an LL hook (kernel-owned).

const { app, BrowserWindow, screen } = require('electron');
const path = require('path');

const NATIVE_ONLY = process.argv.includes('--native-only');
const LOCK_SECONDS = Math.min(50, Math.max(3, Number(process.env.LOCK_SECONDS) || 8));
const PRECOUNT_SECONDS = 3;

function log(msg) { console.log(`[lock-test] ${msg}`); }

// Small always-on-top status panel so the tester sees a live countdown even
// while the transparent lock overlay is up.
let statusWin = null;
function showStatus() {
  const { bounds } = screen.getPrimaryDisplay();
  statusWin = new BrowserWindow({
    x: bounds.x + Math.round((bounds.width - 460) / 2),
    y: bounds.y + 40,
    width: 460,
    height: 150,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  statusWin.setAlwaysOnTop(true, 'screen-saver');
  statusWin.setIgnoreMouseEvents(true);
  const html = `<!DOCTYPE html><html><body style="margin:0;font-family:Segoe UI,sans-serif">
    <div id="b" style="background:rgba(20,20,30,.92);color:#fff;border:2px solid #E94560;border-radius:12px;padding:16px 20px;text-align:center">
      <div id="t" style="font-size:18px;font-weight:600">preparing…</div>
      <div id="s" style="font-size:13px;opacity:.8;margin-top:8px">Ctrl+Alt+Del always works as an escape hatch</div>
    </div></body></html>`;
  statusWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
  return statusWin;
}
function setStatus(title, color) {
  if (!statusWin || statusWin.isDestroyed()) return;
  statusWin.webContents.executeJavaScript(
    `(()=>{const t=document.getElementById('t');if(t){t.textContent=${JSON.stringify(title)};` +
    (color ? `t.style.color=${JSON.stringify(color)};` : '') + `}})()`
  ).catch(() => {});
}
function closeStatus() {
  if (statusWin && !statusWin.isDestroyed()) statusWin.close();
  statusWin = null;
}

async function runFullMode() {
  const keyboard = require('../src/main/actions/keyboard');
  log(`FULL mode — engaging lockKeyboard() for ${LOCK_SECONDS}s after a ${PRECOUNT_SECONDS}s pre-countdown.`);
  log('Switch focus to Notepad/another window now and try typing once locked.');

  for (let i = PRECOUNT_SECONDS; i > 0; i--) {
    setStatus(`Locking in ${i}…  switch to another window`);
    log(`locking in ${i}…`);
    await delay(1000);
  }

  keyboard.lockKeyboard();
  log('LOCKED — keyboard should now be dead system-wide. Try typing.');

  for (let i = LOCK_SECONDS; i > 0; i--) {
    setStatus(`🔒 LOCKED — auto-unlock in ${i}s`, '#E94560');
    await delay(1000);
  }

  keyboard.unlockKeyboard(); // logs how many keystrokes uiohook saw swallowed
  setStatus('✅ UNLOCKED', '#4ADE80');
  log('UNLOCKED — keyboard restored. (See the swallowed-keystroke count above.)');
  await delay(1200);
}

async function runNativeOnlyMode() {
  const addon = require('../src/native/keyboard_hook.node');
  log(`NATIVE-ONLY mode — addon startBlock() for ${LOCK_SECONDS}s, no overlay/uiohook.`);
  log('Switch focus to Notepad/another window now.');

  for (let i = PRECOUNT_SECONDS; i > 0; i--) {
    setStatus(`Locking in ${i}…  switch to another window`);
    log(`locking in ${i}…`);
    await delay(1000);
  }

  const ok = addon.startBlock();
  log(`startBlock() => ${ok}`);
  if (!ok) { setStatus('❌ startBlock failed', '#E94560'); await delay(1500); return; }

  for (let i = LOCK_SECONDS; i > 0; i--) {
    setStatus(`🔒 NATIVE LOCK — release in ${i}s`, '#E94560');
    await delay(1000);
  }

  log(`stopBlock() => ${addon.stopBlock()}`);
  setStatus('✅ RELEASED', '#4ADE80');
  log('RELEASED — keyboard restored.');
  await delay(1200);
}

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

app.whenReady().then(async () => {
  if (process.platform !== 'win32') {
    log('WARNING: real blocking only works on win32; this is a no-op elsewhere.');
  }
  showStatus();

  // Hard watchdog: whatever happens, the process dies (and the OS hook with it)
  // shortly after the intended window. This is the ultimate "never stuck" net.
  const watchdog = setTimeout(() => {
    log('watchdog fired — force exiting to guarantee the keyboard is freed.');
    process.exit(0);
  }, (PRECOUNT_SECONDS + LOCK_SECONDS + 10) * 1000);
  watchdog.unref?.();

  try {
    if (NATIVE_ONLY) await runNativeOnlyMode();
    else await runFullMode();
  } catch (err) {
    log(`ERROR: ${err && err.stack ? err.stack : err}`);
    // Best-effort release on error.
    try { require('../src/native/keyboard_hook.node').stopBlock(); } catch { /* ignore */ }
  } finally {
    clearTimeout(watchdog);
    closeStatus();
    app.quit();
    setTimeout(() => process.exit(0), 500);
  }
});

app.on('window-all-closed', () => { /* keep alive until our flow finishes */ });
