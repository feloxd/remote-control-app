const { BrowserWindow, screen } = require('electron');

const LEVELS = {
  media: 'floating',
  image: 'pop-up-menu',
  overlay: 'screen-saver',
  top: 'screen-saver',
  text: 'screen-saver',
};

const PRIORITY = {
  media: 0,
  image: 1,
  overlay: 2,
  top: 2,
  text: 3,
};

const trackedWindows = new Map(
  Object.keys(PRIORITY).map((level) => [level, new Set()]),
);

function displayBounds() {
  return screen.getAllDisplays().map((display) => display.bounds);
}

function createDisplayWindow(bounds, title, options = {}) {
  const level = options.level || 'overlay';
  const win = new BrowserWindow({
    title,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    fullscreen: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: options.backgroundColor || '#000000',
    hasShadow: options.hasShadow ?? false,
    roundedCorners: options.roundedCorners ?? false,
    focusable: options.focusable ?? false,
    transparent: options.transparent ?? false,
    show: options.show ?? true,
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required',
      nodeIntegration: false,
      contextIsolation: true,
      ...(options.webPreferences || {}),
    },
  });

  win.setMenuBarVisibility(false);
  if (options.transparent) win.setBackgroundColor('#00000000');
  win.setAlwaysOnTop(true, LEVELS[level]);
  win.setBounds(bounds, false);
  if (options.ignoreMouse) win.setIgnoreMouseEvents(true);
  trackedWindows.get(level)?.add(win);
  win.once('closed', () => trackedWindows.get(level)?.delete(win));
  return win;
}

function createDisplayWindows(title, options = {}) {
  return displayBounds().map((bounds) => createDisplayWindow(bounds, title, options));
}

function destroyWindows(windows) {
  for (const win of windows || []) {
    if (win && !win.isDestroyed()) win.destroy();
  }
}

function raiseLayer(windows, level) {
  for (const win of windows || []) {
    if (!win || win.isDestroyed()) continue;
    win.setAlwaysOnTop(true, LEVELS[level]);
    if (level === 'image' || level === 'text') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    win.moveTop();
  }
}

function raiseWindows(windows, level = 'overlay') {
  raiseLayer(windows, level);

  const currentPriority = PRIORITY[level] ?? PRIORITY.overlay;
  const higherLevels = Object.keys(PRIORITY)
    .filter((candidate) => PRIORITY[candidate] > currentPriority)
    .sort((a, b) => PRIORITY[a] - PRIORITY[b]);

  for (const higherLevel of higherLevels) {
    raiseLayer(trackedWindows.get(higherLevel), higherLevel);
  }
}

function loadHtml(win, html) {
  return win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
}

module.exports = {
  createDisplayWindows,
  createDisplayWindow,
  destroyWindows,
  raiseWindows,
  loadHtml,
};
