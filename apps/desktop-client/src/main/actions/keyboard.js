const { BrowserWindow, screen } = require('electron');
const path = require('path');

const FAILSAFE_MS = 60_000;
const FOCUS_INTERVAL_MS = 500;

let lockWin       = null;
let failsafeTimer = null;
let focusTimer    = null;
let swallowedKeys = 0;

// Native system-wide blocker (WH_KEYBOARD_LL) state. The hook now lives in a
// compiled N-API addon (src/native/keyboard_hook.node) instead of a spawned
// PowerShell process: no child process, no temp script, faster engage/release.
let kbHook       = null;   // lazily-required addon handle
let nativeActive = false;  // true while the native hook is installed

// uiohook-napi handle — used for detection/telemetry only. It CANNOT suppress
// events (its N-API binding dispatches asynchronously, so the native hook has
// already returned CallNextHookEx before our JS runs). The real suppression is
// done by the WH_KEYBOARD_LL native addon below; uiohook just lets us count
// how many keystrokes the participant attempted while locked.
let uiohook       = null;
let uiohookActive = false;

// ── Real system-level keyboard block ─────────────────────────────────────────
// A compiled N-API addon installs a low-level keyboard hook (WH_KEYBOARD_LL) on
// a dedicated worker thread that pumps a Win32 message loop. The hook returns a
// non-zero value for every key event, swallowing it before it reaches any
// application. stopBlock() posts WM_QUIT to that thread, which unhooks and
// restores the keyboard. Ctrl+Alt+Del cannot be intercepted by an LL hook (the
// kernel owns it), so it always remains an escape hatch alongside the 60s
// failsafe. The addon binary is unpacked from the asar (see electron-builder.yml).
function loadHookAddon() {
  if (kbHook) return kbHook;
  // Resolves in dev (src/native/) and when packaged (Electron transparently
  // maps the require into app.asar.unpacked/ since the .node is asarUnpack'd).
  kbHook = require(path.join(__dirname, '..', '..', 'native', 'keyboard_hook.node'));
  return kbHook;
}

function startNativeBlocker() {
  if (process.platform !== 'win32') {
    console.warn('[lock_keyboard] native blocker only supported on win32; overlay-only fallback');
    return false;
  }
  if (nativeActive) return true;

  try {
    const ok = loadHookAddon().startBlock();
    if (ok) {
      nativeActive = true;
      console.log('[lock_keyboard] native WH_KEYBOARD_LL hook installed');
      return true;
    } else {
      console.error('[lock_keyboard] native startBlock() returned false (SetWindowsHookEx failed)');
    }
  } catch (err) {
    // Addon missing/incompatible: fall through to the overlay-only visual block.
    console.error(`[lock_keyboard] native blocker unavailable: ${err.message}`);
  }
  return false;
}

function stopNativeBlocker() {
  if (!nativeActive || !kbHook) return;
  try {
    kbHook.stopBlock();  // posts WM_QUIT, joins the hook thread, unhooks
  } catch (err) {
    console.error(`[unlock_keyboard] native stopBlock() error: ${err.message}`);
  }
  nativeActive = false;
}

// ── uiohook detection (telemetry only — does NOT block) ──────────────────────
function startUiohookDetection() {
  if (uiohookActive) return;
  try {
    if (!uiohook) ({ uIOhook: uiohook } = require('uiohook-napi'));
    uiohook.removeAllListeners('keydown');
    uiohook.on('keydown', () => { swallowedKeys += 1; });
    uiohook.start();
    uiohookActive = true;
    console.log('[lock_keyboard] uiohook detection started');
  } catch (err) {
    // Detection is a non-critical complement; the native blocker still works.
    console.warn(`[lock_keyboard] uiohook unavailable (detection disabled): ${err.message}`);
  }
}

function stopUiohookDetection() {
  if (!uiohookActive || !uiohook) return;
  try {
    uiohook.removeAllListeners('keydown');
    uiohook.stop();
  } catch (err) {
    console.warn(`[unlock_keyboard] uiohook stop error: ${err.message}`);
  }
  uiohookActive = false;
}

// ── Visual backup overlay (Electron) ─────────────────────────────────────────
function startOverlay() {
  if (lockWin) return;
  const { bounds } = screen.getPrimaryDisplay();

  lockWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width:  bounds.width,
    height: bounds.height,
    fullscreen:  true,
    frame:       false,
    transparent: true,
    backgroundColor: '#00000000',
    skipTaskbar: true,
    focusable:   true,
    show:        false,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });

  lockWin.setAlwaysOnTop(true, 'pop-up-menu');
  lockWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  lockWin.setOpacity(0);
  lockWin.loadURL(
    'data:text/html;charset=utf-8,' +
    encodeURIComponent(
      '<!doctype html><html><body style="margin:0;width:100vw;height:100vh;background:transparent"></body></html>',
    ),
  );
  lockWin.setIgnoreMouseEvents(true);

  lockWin.once('ready-to-show', () => {
    lockWin.show();
    lockWin.focus();
  });

  // Re-grab focus so Electron's before-input-event stays wired to us as a
  // secondary swallow path even if another app takes the foreground.
  lockWin.on('blur', () => {
    if (lockWin && !lockWin.isDestroyed()) lockWin.focus();
  });
  lockWin.webContents.on('before-input-event', (event) => {
    event.preventDefault();
  });
  lockWin.on('closed', () => { lockWin = null; });

  focusTimer = setInterval(() => {
    if (lockWin && !lockWin.isDestroyed()) lockWin.focus();
  }, FOCUS_INTERVAL_MS);
}

function stopOverlay() {
  if (focusTimer) {
    clearInterval(focusTimer);
    focusTimer = null;
  }
  if (lockWin) {
    lockWin.removeAllListeners('blur');
    if (!lockWin.isDestroyed()) lockWin.destroy();
    lockWin = null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────
function lockKeyboard() {
  if (nativeActive || lockWin) {
    console.log('[lock_keyboard] already active, ignoring duplicate call');
    return;
  }

  console.log('[lock_keyboard] engaging system-level keyboard block…');
  swallowedKeys = 0;

  const hasNativeBlocker = startNativeBlocker(); // real WH_KEYBOARD_LL suppression
  startUiohookDetection();   // telemetry (key-attempt counter)

  if (!hasNativeBlocker) {
    startOverlay();          // fallback only; the native blocker needs no window
  }

  failsafeTimer = setTimeout(() => {
    console.warn('[lock_keyboard] 60s failsafe fired — auto-unlocking');
    unlockKeyboard();
  }, FAILSAFE_MS);
}

function unlockKeyboard() {
  if (failsafeTimer) {
    clearTimeout(failsafeTimer);
    failsafeTimer = null;
  }
  if (!nativeActive && !lockWin && !uiohookActive) {
    console.log('[unlock_keyboard] no lock active, nothing to release');
    return;
  }

  console.log(`[unlock_keyboard] releasing (participant attempted ${swallowedKeys} keystroke(s) while locked)`);
  stopNativeBlocker();
  stopUiohookDetection();
  stopOverlay();
}

module.exports = { lockKeyboard, unlockKeyboard };
