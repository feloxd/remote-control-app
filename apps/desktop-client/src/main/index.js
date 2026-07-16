const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell } = require('electron');
const path = require('path');
const zlib = require('zlib');
const { connectSocket, disconnectSocket, getServerUrl } = require('./socket');
const cursor = require('./actions/cursor');

let mainWindow;
let tray;
let isQuitting = false;

// ── Tray icon: generates a valid 16×16 #E94560 PNG at runtime ──────────────
function buildTrayIcon() {
  const W = 16, H = 16;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    const row = y * (1 + W * 3);
    raw[row] = 0;
    for (let x = 0; x < W; x++) {
      const px = row + 1 + x * 3;
      raw[px] = 0xE9; raw[px + 1] = 0x45; raw[px + 2] = 0x60;
    }
  }
  const compressed = zlib.deflateSync(raw);

  function crc32(buf) {
    const tbl = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      tbl[n] = c;
    }
    let crc = 0xFFFFFFFF;
    for (const b of buf) crc = tbl[(crc ^ b) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function chunk(type, data) {
    const t   = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2;

  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  return nativeImage.createFromBuffer(png);
}

// ── Main window ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 480,
    resizable: false,
    frame: true,
    title: 'Remote Control Client',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  mainWindow.setMenuBarVisibility(false);

  // Prevent Alt+F4 — only quit via tray
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── System tray ──────────────────────────────────────────────────────────────
function createTray() {
  const icon = buildTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Remote Control Client');

  const startAtLogin = app.getLoginItemSettings().openAtLogin;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show window',  click: () => { mainWindow.show(); mainWindow.focus(); } },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: startAtLogin,
      click: (item) => {
        app.setLoginItemSettings({
          openAtLogin: item.checked,
          path: app.getPath('exe'),
        });
      },
    },
    { type: 'separator' },
    { label: 'Quit',         click: () => { isQuitting = true; app.quit(); } },
  ]));

  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────
// Single-instance lock. This is a persistent tray app (window-all-closed is a
// no-op), so without this guard every launch would spawn another instance that
// never exits. They pile up, keep "Remote Control Client.exe" file-locked, and
// then block installer upgrades — leaving the user silently running stale code.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // A second launch just surfaces the existing window instead of starting anew.
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();
    createTray();

    // Auto-connect — no user interaction required
    mainWindow.webContents.once('did-finish-load', () => {
      connectSocket(mainWindow);
    });
  });
}

app.on('before-quit', () => {
  isQuitting = true;
  disconnectSocket();
});

process.once('exit', () => {
  cursor.restoreCursor();
});

// Suppress default quit on all-windows-closed; tray keeps app alive
app.on('window-all-closed', () => {});

ipcMain.handle('leave-session', () => {
  disconnectSocket();
  setTimeout(() => connectSocket(mainWindow), 300);
});

ipcMain.handle('open-source-code', async () => {
  await shell.openExternal(`${getServerUrl()}/source`);
  return true;
});
