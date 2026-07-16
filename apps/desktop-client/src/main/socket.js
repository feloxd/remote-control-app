const { io } = require('socket.io-client');
const { ipcMain, app } = require('electron');
const fs   = require('fs');
const path = require('path');
const browser  = require('./actions/browser');
const media    = require('./actions/media');
const overlay  = require('./actions/overlay');
const cursor   = require('./actions/cursor');
const keyboard = require('./actions/keyboard');
const screen   = require('./actions/screen');
const lock     = require('./actions/lock');
const fileTransfer = require('./fileTransfer');

const DEFAULT_SERVER_URL = 'http://178.156.186.132';

// Resolve the server URL at startup, in priority order:
//   1. SERVER_URL env var — quick override for dev / CI.
//   2. config.json ({"serverUrl": "..."}) sitting next to the installed .exe —
//      lets the same build be re-pointed at another server per machine without
//      a rebuild. Absent/invalid file silently falls through.
//   3. DEFAULT_SERVER_URL — the production VPS, baked in.
function resolveServerUrl() {
  if (process.env.SERVER_URL) {
    return process.env.SERVER_URL.replace(/\/+$/, '');
  }
  try {
    const cfgPath = path.join(path.dirname(app.getPath('exe')), 'config.json');
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg.serverUrl) return String(cfg.serverUrl).replace(/\/+$/, '');
  } catch {
    // no config.json (or unreadable/invalid) → use the default below
  }
  return DEFAULT_SERVER_URL;
}

const SERVER_URL = resolveServerUrl();
console.log(`[socket] server URL: ${SERVER_URL}`);

let socket = null;
let win    = null;

function clearRemoteActions() {
  media.stopAllMedia();
  overlay.clearTopEffects();
  cursor.restoreCursor();
  keyboard.unlockKeyboard();
  lock.clearFilters().catch((err) =>
    console.error('[cleanup] clearFilters failed:', err.message),
  );
  fileTransfer.abortAllTransfers().catch((err) =>
    console.error('[cleanup] file transfer cleanup failed:', err.message),
  );
}

const HANDLERS = {
  open_url:        (p) => browser.openUrl(p),
  show_image:      (p) => media.showImage(p),
  close_image:     ()  => media.closeImage(),
  play_video:      (p) => media.playVideo(p),
  close_video:     ()  => media.closeVideo(),
  play_audio:      (p) => media.playAudio(p),
  stop_audio:      ()  => media.stopAudio(),
  show_overlay:    (p) => overlay.showOverlay(p),
  hide_overlay:    ()  => overlay.hideOverlay(),
  pixelate_screen: (p) => overlay.pixelateScreen(p),
  censor_screen:   (p) => overlay.censorScreen(p),
  show_text:       (p) => overlay.showText(p),
  blackout_screen: (p) => overlay.blackoutScreen(p?.duration || 30),
  hide_cursor:     (p) => cursor.hideCursor(p?.duration || 10),
  lock_keyboard:   ()  => keyboard.lockKeyboard(),
  unlock_keyboard: ()  => keyboard.unlockKeyboard(),
  take_screenshot: ()  => screen.takeScreenshot(),
  lock_screen:     ()  => lock.lockScreen(),
  unlock_screen:   ()  => lock.unlockScreen(),
  filter_sites:    (p) => lock.filterSites(p),
  clear_filters:   ()  => lock.clearFilters(),
};

async function dispatchAction(action, payload) {
  const handler = HANDLERS[action];
  if (!handler) throw new Error(`Unknown action: ${action}`);
  return await handler(payload ?? {});
}

function send(channel, data) {
  win?.webContents?.send(channel, data);
}

function connectSocket(mainWin) {
  win = mainWin;
  if (socket) { socket.disconnect(); socket = null; }

  socket = io(`${SERVER_URL}/client`, {
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 15000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[socket] connected');
    send('status', { state: 'pending', message: 'Ingresa un código de sesión' });
  });

  socket.on('session_created', ({ code }) => {
    console.log(`[socket] session code: ${code}`);
    send('session-code', code);
    send('status', { state: 'pending', message: 'Waiting for operator...' });
  });

  socket.on('session_active', () => {
    console.log('[socket] session active');
    send('status', { state: 'active' });
  });

  socket.on('session_error', ({ message } = {}) => {
    send('status', {
      state: 'pending',
      message: message || 'No fue posible unirse a la sesión',
    });
  });

  socket.on('operator_disconnected', () => {
    send('status', { state: 'pending', message: 'Operador desconectado — ingresa un código' });
    // Nothing the operator started should outlive the session: stop any audio /
    // video / image popups and clear the site filters so the next user gets a
    // clean machine.
    clearRemoteActions();
  });

  socket.on('action', async ({ action, payload }) => {
    try {
      const result = await dispatchAction(action, payload);
      socket.emit('action_ack', { action, success: true, result: result ?? null });
    } catch (err) {
      console.error(`[action] ${action} failed:`, err.message);
      socket.emit('action_ack', { action, success: false, error: err.message });
    }
  });

  const transferStatus = (transferId, state, details = {}) => {
    socket.emit('file_transfer_status', { transferId, state, ...details });
  };

  socket.on('file_transfer_start', async (metadata) => {
    try {
      const result = await fileTransfer.startTransfer(metadata);
      transferStatus(metadata.transferId, 'receiving', { name: result.name, directory: result.directory });
    } catch (error) {
      transferStatus(metadata?.transferId, 'error', { error: error.message });
    }
  });

  socket.on('file_transfer_chunk', async (payload) => {
    try {
      const result = await fileTransfer.writeChunk(payload);
      transferStatus(payload.transferId, 'receiving', result);
    } catch (error) {
      await fileTransfer.abortTransfer(payload?.transferId);
      transferStatus(payload?.transferId, 'error', { error: error.message });
    }
  });

  socket.on('file_transfer_end', async ({ transferId } = {}) => {
    try {
      const result = await fileTransfer.finishTransfer({ transferId });
      transferStatus(transferId, 'complete', result);
    } catch (error) {
      transferStatus(transferId, 'error', { error: error.message });
    }
  });

  socket.on('file_transfer_cancel', async ({ transferId } = {}) => {
    await fileTransfer.abortTransfer(transferId);
    transferStatus(transferId, 'cancelled');
  });

  socket.on('error', ({ message }) => {
    send('status', { state: 'error', message });
  });

  socket.on('disconnect', (reason) => {
    console.log(`[socket] disconnected: ${reason}`);
    send('status', { state: 'disconnected', message: 'Reconnecting...' });
  });

  socket.on('reconnect', (attempt) => {
    console.log(`[socket] reconnected after ${attempt} attempt(s)`);
    // create_session is emitted from the 'connect' handler which fires on reconnect
  });

  socket.on('reconnect_attempt', (attempt) => {
    send('status', { state: 'reconnecting', message: `Reconnecting... (${attempt})` });
  });
}

function disconnectSocket() {
  clearRemoteActions();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

ipcMain.handle('join-session', (event, code) => {
  if (socket?.connected) {
    socket.emit('join_client', { code });
  }
});

module.exports = { connectSocket, disconnectSocket, getServerUrl: () => SERVER_URL };
