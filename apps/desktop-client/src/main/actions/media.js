const { BrowserWindow, shell } = require('electron');
const http = require('http');
const {
  createDisplayWindows,
  destroyWindows,
  loadHtml,
  raiseWindows,
} = require('./windowManager');

let audioWin = null;
let videoWins = [];
let imageWins = [];

function safeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function closeTracked(windows) {
  destroyWindows(windows);
  return [];
}

const ESCAPE_TO_CLOSE =
  `<script>window.addEventListener('keydown',e=>{if(e.key==='Escape')window.close();});</script>`;

async function showImage({ url, path: filePath } = {}) {
  if (filePath) {
    await shell.openPath(filePath);
    return;
  }
  if (!url) throw new Error('show_image requires url or path');

  imageWins = closeTracked(imageWins);
  imageWins = createDisplayWindows('Image', {
    level: 'image',
    focusable: false,
    ignoreMouse: true,
    show: false,
  });

  const html =
    `<!doctype html><html><head><style>` +
    `html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}` +
    `img{position:fixed;inset:0;margin:auto;max-width:100%;max-height:100%}` +
    `</style></head><body>` +
    `<img src="${safeAttr(url)}">` +
    ESCAPE_TO_CLOSE +
    `</body></html>`;

  for (const win of imageWins) {
    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return;
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.showInactive();
      raiseWindows([win], 'image');
    });
    loadHtml(win, html).catch((err) => {
      if (!win.isDestroyed()) {
        console.error(`[show_image] failed to load image window: ${err.message}`);
      }
    });
    win.on('closed', () => {
      imageWins = imageWins.filter((w) => w !== win);
    });
  }
}

function closeImage() {
  imageWins = closeTracked(imageWins);
}

function isYouTube(url) {
  return /(?:^|\.)youtube\.com|youtu\.be/i.test(url);
}

function toYouTubeEmbed(url) {
  const short = url.match(/youtu\.be\/([^?&/]+)/i);
  if (short) return `https://www.youtube.com/embed/${short[1]}`;
  return url.includes('/watch?v=') ? url.replace('/watch?v=', '/embed/') : url;
}

function withYouTubeLoop(embedUrl) {
  const match = embedUrl.match(/\/embed\/([^?&/]+)/);
  if (!match) return embedUrl;
  const videoId = match[1];
  const sep = embedUrl.includes('?') ? '&' : '?';
  return `${embedUrl}${sep}autoplay=1&loop=1&playlist=${videoId}`;
}

const YT_EMBED_RE = /^https:\/\/www\.youtube(?:-nocookie)?\.com\/embed\//;
let ytServer = null;
let ytPort = 0;

function ytIframePage(embed) {
  return (
    `<!doctype html><html><head><style>` +
    `html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}` +
    `iframe{position:fixed;inset:0;width:100%;height:100%;border:0}` +
    `</style></head><body>` +
    `<iframe src="${safeAttr(embed)}" allow="autoplay; fullscreen; encrypted-media" allowfullscreen></iframe>` +
    ESCAPE_TO_CLOSE +
    `</body></html>`
  );
}

function ensureYtServer() {
  if (ytServer) return Promise.resolve(ytPort);
  return new Promise((resolve, reject) => {
    ytServer = http.createServer((req, res) => {
      let embed = '';
      try {
        embed = new URL(req.url, 'http://127.0.0.1').searchParams.get('embed') || '';
      } catch {
        embed = '';
      }
      if (!YT_EMBED_RE.test(embed)) embed = 'about:blank';
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(ytIframePage(embed));
    });
    ytServer.on('error', (err) => {
      ytServer = null;
      reject(err);
    });
    ytServer.listen(0, '127.0.0.1', () => {
      ytPort = ytServer.address().port;
      resolve(ytPort);
    });
  });
}

function directVideoPage(url) {
  return (
    `<!doctype html><html><head><style>` +
    `html,body{margin:0;width:100%;height:100%;background:#000;overflow:hidden}` +
    `video{position:fixed;inset:0;width:100%;height:100%;object-fit:contain;background:#000}` +
    `</style></head><body>` +
    `<video src="${safeAttr(url)}" autoplay loop controls></video>` +
    ESCAPE_TO_CLOSE +
    `<script>` +
    `const v=document.querySelector('video');` +
    `const play=()=>v.play().catch(()=>setTimeout(play,500));` +
    `v.addEventListener('canplay',play,{once:true});play();` +
    `</script>` +
    `</body></html>`
  );
}

function loadWindow(win, target) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      win.webContents.removeListener('did-finish-load', onLoad);
      win.webContents.removeListener('did-fail-load', onFail);
    };
    const onLoad = () => {
      cleanup();
      win.setBounds(win.__displayBounds, false);
      win.show();
      win.moveTop();
      resolve();
    };
    const onFail = (_event, code, description, validatedUrl, isMainFrame) => {
      if (isMainFrame === false) return;
      cleanup();
      reject(new Error(`Video load failed (${code}): ${description} ${validatedUrl || ''}`.trim()));
    };
    win.webContents.once('did-finish-load', onLoad);
    win.webContents.on('did-fail-load', onFail);
    target();
  });
}

async function playVideo({ url, path: filePath } = {}) {
  if (filePath) {
    await shell.openPath(filePath);
    return;
  }
  if (!url) throw new Error('play_video requires url or path');

  videoWins = closeTracked(videoWins);
  videoWins = createDisplayWindows('Video', {
    level: 'media',
    focusable: true,
    show: false,
  });
  for (const win of videoWins) win.__displayBounds = win.getBounds();

  let loads;
  if (isYouTube(url)) {
    const embed = withYouTubeLoop(toYouTubeEmbed(url));
    const port = await ensureYtServer();
    const pageUrl = `http://127.0.0.1:${port}/?embed=${encodeURIComponent(embed)}`;
    loads = videoWins.map((win) => loadWindow(win, () => {
      win.loadURL(pageUrl).catch(() => {});
    }));
  } else {
    const html = directVideoPage(url);
    loads = videoWins.map((win) => loadWindow(win, () => {
      loadHtml(win, html).catch(() => {});
    }));
  }

  for (const win of videoWins) {
    win.on('closed', () => {
      videoWins = videoWins.filter((w) => w !== win);
    });
  }

  const results = await Promise.allSettled(loads);
  const failures = results.filter((result) => result.status === 'rejected');
  if (failures.length) {
    console.error(`[play_video] ${failures.length}/${results.length} display window(s) failed to load`);
    for (const failure of failures) console.error(`[play_video] ${failure.reason.message}`);
  }
}

function closeVideo() {
  videoWins = closeTracked(videoWins);
}

async function playAudio({ url, path: filePath } = {}) {
  if (filePath) {
    await shell.openPath(filePath);
    return;
  }
  if (!url) throw new Error('play_audio requires url or path');

  if (audioWin && !audioWin.isDestroyed()) audioWin.destroy();
  audioWin = new BrowserWindow({
    show: false,
    webPreferences: {
      autoplayPolicy: 'no-user-gesture-required',
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const html =
    `<!doctype html><html><body>` +
    `<audio autoplay src="${safeAttr(url)}"></audio>` +
    `<script>` +
      `const a = document.querySelector('audio');` +
      `a.addEventListener('ended', () => window.close());` +
      `a.addEventListener('error', () => window.close());` +
    `</script>` +
    `</body></html>`;
  loadHtml(audioWin, html);
  audioWin.on('closed', () => { audioWin = null; });
}

function stopAudio() {
  if (audioWin && !audioWin.isDestroyed()) audioWin.destroy();
  audioWin = null;
}

function raiseMedia() {
  raiseWindows(imageWins, 'image');
  raiseWindows(videoWins, 'media');
}

function stopAllMedia() {
  stopAudio();
  closeVideo();
  closeImage();
}

module.exports = {
  showImage,
  closeImage,
  playVideo,
  closeVideo,
  playAudio,
  stopAudio,
  raiseMedia,
  stopAllMedia,
};
