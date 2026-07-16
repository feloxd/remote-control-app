const { desktopCapturer, nativeImage, screen } = require('electron');
const path = require('path');
const {
  createDisplayWindows,
  createDisplayWindow,
  destroyWindows,
  loadHtml,
  raiseWindows,
} = require('./windowManager');
const aiCensorDetector = require('./aiCensorDetector');

let overlayWins = [];
let blackoutWins = [];
let pixelateWins = [];
let censorWins = [];
let textWins = [];
let blackoutTimer = null;
let textTimer = null;
let censorTimer = null;
let censorRunning = false;
let censorOptions = null;
let censorAiDisabledReason = null;
const censorTracks = new Map();

const VALID_SPEEDS = ['slow', 'normal', 'fast'];

function normalizeSpeed(speed) {
  return VALID_SPEEDS.includes(speed) ? speed : 'normal';
}

function destroyTracked(windows) {
  destroyWindows(windows);
  return [];
}

function attachCleanup(collectionName, win) {
  win.on('closed', () => {
    if (collectionName === 'overlay') overlayWins = overlayWins.filter((w) => w !== win);
    if (collectionName === 'blackout') blackoutWins = blackoutWins.filter((w) => w !== win);
    if (collectionName === 'pixelate') pixelateWins = pixelateWins.filter((w) => w !== win);
    if (collectionName === 'censor') censorWins = censorWins.filter((w) => w !== win);
    if (collectionName === 'text') textWins = textWins.filter((w) => w !== win);
  });
}

function showOverlay({ speed = 'normal' } = {}) {
  const normalized = normalizeSpeed(speed);

  if (overlayWins.length) {
    for (const win of overlayWins) {
      if (win.isDestroyed()) continue;
      win.webContents
        .executeJavaScript(`typeof setSpeed === 'function' && setSpeed(${JSON.stringify(normalized)})`)
        .catch(() => {});
    }
    raiseWindows(overlayWins, 'top');
    raiseWindows(textWins, 'text');
    return;
  }

  overlayWins = createDisplayWindows('Overlay', {
    transparent: false,
    focusable: false,
    ignoreMouse: true,
    level: 'top',
    backgroundColor: '#ffffff',
  });

  for (const win of overlayWins) {
    win.loadFile(path.join(__dirname, '../../renderer/overlay.html'));
    win.webContents.once('did-finish-load', () => {
      win.webContents
        .executeJavaScript(`init(${JSON.stringify(normalized)})`)
        .catch(() => {});
      win.setOpacity(0.55);
      raiseWindows([win], 'top');
    });
    attachCleanup('overlay', win);
  }
  raiseWindows(textWins, 'text');
}

function hideOverlay() {
  overlayWins = destroyTracked(overlayWins);
}

function blackoutScreen(duration = 30) {
  if (blackoutTimer) {
    clearTimeout(blackoutTimer);
    blackoutTimer = null;
  }
  blackoutWins = destroyTracked(blackoutWins);

  blackoutWins = createDisplayWindows('Blackout', {
    focusable: false,
    ignoreMouse: true,
    level: 'top',
    backgroundColor: '#000000',
  });

  const html = '<html><body style="margin:0;background:#000;width:100vw;height:100vh"></body></html>';
  for (const win of blackoutWins) {
    loadHtml(win, html);
    attachCleanup('blackout', win);
  }
  raiseWindows(textWins, 'text');

  blackoutTimer = setTimeout(() => {
    blackoutWins = destroyTracked(blackoutWins);
    blackoutTimer = null;
  }, Math.max(1, Number(duration) || 30) * 1000);
  blackoutTimer.unref?.();
}

async function pixelateScreen({ enabled = true, size = 24 } = {}) {
  const shouldEnable = enabled !== false && enabled !== 'false' && enabled !== 'off';
  if (!shouldEnable) {
    pixelateWins = destroyTracked(pixelateWins);
    return;
  }

  pixelateWins = destroyTracked(pixelateWins);

  const displays = require('electron').screen.getAllDisplays();
  const maxWidth = Math.max(...displays.map((display) => display.bounds.width));
  const maxHeight = Math.max(...displays.map((display) => display.bounds.height));
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxWidth, height: maxHeight },
  });
  if (!sources.length) throw new Error('No screen source available');

  pixelateWins = displays.map((display, index) => {
    const source =
      sources.find((item) => String(item.display_id) === String(display.id)) ||
      sources[index] ||
      sources[0];
    const ratio = Math.max(6, Number(size) || 24);
    const tiny = source.thumbnail.resize({
      width: Math.max(1, Math.round(display.bounds.width / ratio)),
      height: Math.max(1, Math.round(display.bounds.height / ratio)),
      quality: 'best',
    });
    const image = nativeImage.createFromDataURL(tiny.toDataURL()).toDataURL();
    const win = createDisplayWindow(display.bounds, 'Pixelate', {
      focusable: false,
      ignoreMouse: true,
      level: 'top',
      backgroundColor: '#000000',
    });

    loadHtml(win, pixelatePage(image));
    attachCleanup('pixelate', win);
    return win;
  });
  raiseWindows(textWins, 'text');
}

function pixelatePage(dataUrl) {
  return (
    `<!doctype html><html><head><style>` +
    `html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#000}` +
    `img{width:100%;height:100%;object-fit:cover;image-rendering:pixelated;}` +
    `</style></head><body><img src="${dataUrl}"></body></html>`
  );
}

function censorPage() {
  return (
    `<!doctype html><html><head><style>` +
    `html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}` +
    `.region{position:absolute;overflow:hidden;background-repeat:no-repeat;image-rendering:pixelated;}` +
    `</style></head><body><div id="root"></div><script>` +
    `const root=document.getElementById('root');` +
    `window.updateCensor=(image,regions)=>{` +
      `root.textContent='';` +
      `for(const r of regions){` +
        `const el=document.createElement('div');` +
        `el.className='region';` +
        `el.style.left=r.x+'px';el.style.top=r.y+'px';` +
        `el.style.width=r.w+'px';el.style.height=r.h+'px';` +
        `el.style.backgroundImage='url('+image+')';` +
        `el.style.backgroundSize='100vw 100vh';` +
        `el.style.backgroundPosition=(-r.x)+'px '+(-r.y)+'px';` +
        `root.appendChild(el);` +
      `}` +
    `};` +
    `</script></body></html>`
  );
}

function skinLike(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return (
    r > 70 &&
    g > 35 &&
    b > 20 &&
    max - min > 15 &&
    Math.abs(r - g) > 10 &&
    r > g &&
    r > b
  ) || (
    r > 95 &&
    g > 65 &&
    b > 45 &&
    r > g &&
    g > b &&
    r - b > 25
  );
}

function detectSkinRegions(image, display, options) {
  const size = image.getSize();
  const width = size.width;
  const height = size.height;
  const bitmap = image.toBitmap();
  const cell = 8;
  const cols = Math.ceil(width / cell);
  const rows = Math.ceil(height / cell);
  const grid = Array.from({ length: rows }, () => Array(cols).fill(false));

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let skin = 0;
      let total = 0;
      const x0 = col * cell;
      const y0 = row * cell;
      const x1 = Math.min(width, x0 + cell);
      const y1 = Math.min(height, y0 + cell);
      for (let y = y0; y < y1; y += 2) {
        for (let x = x0; x < x1; x += 2) {
          const i = (y * width + x) * 4;
          const b = bitmap[i];
          const g = bitmap[i + 1];
          const r = bitmap[i + 2];
          if (skinLike(r, g, b)) skin++;
          total++;
        }
      }
      grid[row][col] = total > 0 && skin / total > 0.32;
    }
  }

  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const regions = [];
  const minCells = options.mode === 'sensitive' ? 3 : 5;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!grid[row][col] || seen[row][col]) continue;
      const stack = [[row, col]];
      seen[row][col] = true;
      let minR = row, maxR = row, minC = col, maxC = col, count = 0;

      while (stack.length) {
        const [r0, c0] = stack.pop();
        count++;
        minR = Math.min(minR, r0); maxR = Math.max(maxR, r0);
        minC = Math.min(minC, c0); maxC = Math.max(maxC, c0);
        for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nr = r0 + dr;
          const nc = c0 + dc;
          if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
          if (seen[nr][nc] || !grid[nr][nc]) continue;
          seen[nr][nc] = true;
          stack.push([nr, nc]);
        }
      }

      if (count < minCells) continue;
      const padCells = options.mode === 'sensitive' ? 2 : 4;
      let x = Math.max(0, (minC - padCells) * cell);
      let y = Math.max(0, (minR - padCells) * cell);
      let w = Math.min(width - x, (maxC - minC + 1 + padCells * 2) * cell);
      let h = Math.min(height - y, (maxR - minR + 1 + padCells * 2) * cell);

      if (options.mode === 'sensitive') {
        const centerY = y + h * 0.5;
        y = Math.max(0, centerY - h * 0.38);
        h = Math.min(height - y, h * 0.76);
      }

      const scaleX = display.bounds.width / width;
      const scaleY = display.bounds.height / height;
      regions.push({
        x: Math.round(x * scaleX),
        y: Math.round(y * scaleY),
        w: Math.round(w * scaleX),
        h: Math.round(h * scaleY),
      });
    }
  }

  return mergeRegions(regions, display.bounds);
}

function mergeRegions(regions, bounds) {
  const merged = [];
  for (const region of regions) {
    if (region.w < 24 || region.h < 24) continue;
    let target = null;
    for (const existing of merged) {
      if (overlaps(expand(existing, 20, bounds), region)) {
        target = existing;
        break;
      }
    }
    if (target) {
      const x1 = Math.min(target.x, region.x);
      const y1 = Math.min(target.y, region.y);
      const x2 = Math.max(target.x + target.w, region.x + region.w);
      const y2 = Math.max(target.y + target.h, region.y + region.h);
      target.x = x1; target.y = y1; target.w = x2 - x1; target.h = y2 - y1;
    } else {
      merged.push(region);
    }
  }
  return merged.slice(0, 28);
}

function expand(region, amount, bounds) {
  const x = Math.max(0, region.x - amount);
  const y = Math.max(0, region.y - amount);
  return {
    x,
    y,
    w: Math.min(bounds.width - x, region.w + amount * 2),
    h: Math.min(bounds.height - y, region.h + amount * 2),
  };
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function regionIou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (!intersection) return 0;
  return intersection / (a.w * a.h + b.w * b.h - intersection);
}

function padRegion(region, bounds, ratio = 0.08) {
  const padX = region.w * ratio;
  const padY = region.h * ratio;
  const x = Math.max(0, region.x - padX);
  const y = Math.max(0, region.y - padY);
  const right = Math.min(bounds.width, region.x + region.w + padX);
  const bottom = Math.min(bounds.height, region.y + region.h + padY);
  return { ...region, x, y, w: right - x, h: bottom - y };
}

function stabilizeCensorRegions(displayId, regions) {
  const key = String(displayId);
  const previous = censorTracks.get(key) || [];
  const used = new Set();
  const next = [];

  for (const region of regions) {
    let matchIndex = -1;
    let bestOverlap = 0.12;
    for (let index = 0; index < previous.length; index++) {
      if (used.has(index) || previous[index].label !== region.label) continue;
      const overlap = regionIou(previous[index], region);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        matchIndex = index;
      }
    }

    if (matchIndex >= 0) {
      used.add(matchIndex);
      const old = previous[matchIndex];
      const freshWeight = 0.58;
      next.push({
        ...region,
        x: old.x * (1 - freshWeight) + region.x * freshWeight,
        y: old.y * (1 - freshWeight) + region.y * freshWeight,
        w: old.w * (1 - freshWeight) + region.w * freshWeight,
        h: old.h * (1 - freshWeight) + region.h * freshWeight,
        misses: 0,
      });
    } else {
      next.push({ ...region, misses: 0 });
    }
  }

  for (let index = 0; index < previous.length; index++) {
    if (used.has(index)) continue;
    const old = previous[index];
    if ((old.misses || 0) < 1) next.push({ ...old, misses: (old.misses || 0) + 1 });
  }

  const limited = next.slice(0, 16);
  censorTracks.set(key, limited);
  return limited.map(({ misses, ...region }) => ({
    ...region,
    x: Math.round(region.x),
    y: Math.round(region.y),
    w: Math.round(region.w),
    h: Math.round(region.h),
  }));
}

function normalizeCensorOptions({
  enabled = true,
  engine = 'ai',
  mode = 'body',
  intensity = 'medium',
  confidence = 0.35,
  fps = 5,
  fallbackEngine = 'skin',
  fallback = false,
  modelPath,
} = {}) {
  const normalizedFps = [3, 5, 7].reduce(
    (closest, candidate) => Math.abs(candidate - Number(fps)) < Math.abs(closest - Number(fps)) ? candidate : closest,
    5,
  );
  return {
    enabled: enabled !== false && enabled !== 'false' && enabled !== 'off',
    engine: engine === 'skin' ? 'skin' : 'ai',
    mode: mode === 'sensitive' ? 'sensitive' : 'body',
    intensity: ['low', 'medium', 'high'].includes(intensity) ? intensity : 'medium',
    confidence: Math.min(0.85, Math.max(0.15, Number(confidence) || 0.35)),
    fps: normalizedFps,
    fallbackEngine: fallbackEngine === 'none' ? 'none' : 'skin',
    fallback: fallback === true || fallback === 'true',
    modelPath: modelPath ? String(modelPath) : undefined,
  };
}

function censorRatio(intensity) {
  if (intensity === 'low') return 14;
  if (intensity === 'high') return 34;
  return 24;
}

async function updateCensorFrame() {
  if (!censorOptions || !censorWins.length) return;

  const displays = screen.getAllDisplays();
  const maxWidth = Math.max(...displays.map((display) => display.bounds.width));
  const maxHeight = Math.max(...displays.map((display) => display.bounds.height));
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxWidth, height: maxHeight },
  });
  if (!sources.length) return;

  const ratio = censorRatio(censorOptions.intensity);
  const stats = { requestedEngine: censorOptions.engine, engine: censorOptions.engine, detections: 0, inferenceMs: 0 };
  for (let index = 0; index < displays.length; index++) {
    const display = displays[index];
    const win = censorWins[index];
    if (!win || win.isDestroyed()) continue;

    const source =
      sources.find((item) => String(item.display_id) === String(display.id)) ||
      sources[index] ||
      sources[0];
    let regions = [];
    let usedAi = censorOptions.engine === 'ai' && !censorAiDisabledReason;

    if (usedAi) {
      try {
        const detected = await aiCensorDetector.detectExplicitRegions(source.thumbnail, {
          confidence: censorOptions.confidence,
          modelPath: censorOptions.modelPath,
        });
        const scaleX = display.bounds.width / detected.frameSize.width;
        const scaleY = display.bounds.height / detected.frameSize.height;
        regions = detected.regions.map((region) => padRegion({
          x: region.x * scaleX,
          y: region.y * scaleY,
          w: region.w * scaleX,
          h: region.h * scaleY,
          label: region.label,
          score: region.score,
        }, display.bounds));
        regions = stabilizeCensorRegions(display.id, regions);
        stats.inferenceMs += detected.inferenceMs;
      } catch (error) {
        censorAiDisabledReason = error.message;
        console.error(`[censor_screen] AI detector unavailable; fallback=${censorOptions.fallbackEngine}: ${error.message}`);
        usedAi = false;
      }
    }

    if (!usedAi && censorOptions.fallbackEngine === 'skin') {
      const sample = source.thumbnail.resize({
        width: Math.max(80, Math.round(display.bounds.width / 6)),
        height: Math.max(45, Math.round(display.bounds.height / 6)),
        quality: 'best',
      });
      regions = detectSkinRegions(sample, display, censorOptions);
      censorTracks.delete(String(display.id));
      stats.engine = 'skin';
    } else if (!usedAi) {
      censorTracks.delete(String(display.id));
      stats.engine = 'none';
    }

    if (!regions.length && censorOptions.fallback) {
      regions = [{ x: 0, y: 0, w: display.bounds.width, h: display.bounds.height }];
    }

    const tiny = source.thumbnail.resize({
      width: Math.max(1, Math.round(display.bounds.width / ratio)),
      height: Math.max(1, Math.round(display.bounds.height / ratio)),
      quality: 'best',
    });
    const dataUrl = tiny.toDataURL();
    win.webContents
      .executeJavaScript(`window.updateCensor(${JSON.stringify(dataUrl)}, ${JSON.stringify(regions)})`)
      .catch(() => {});
    stats.detections += regions.length;
  }
  raiseWindows(textWins, 'text');
  stats.inferenceMs = Number(stats.inferenceMs.toFixed(2));
  return stats;
}

function scheduleCensorLoop() {
  if (!censorOptions) return;
  if (censorTimer) clearInterval(censorTimer);
  censorTimer = setInterval(() => {
    if (censorRunning) return;
    censorRunning = true;
    updateCensorFrame()
      .catch((err) => console.error('[censor_screen] update failed:', err.message))
      .finally(() => { censorRunning = false; });
  }, Math.round(1000 / censorOptions.fps));
  censorTimer.unref?.();
}

async function censorScreen(options = {}) {
  const nextOptions = normalizeCensorOptions(options);
  if (!nextOptions.enabled) {
    if (censorTimer) clearInterval(censorTimer);
    censorTimer = null;
    censorRunning = false;
    censorOptions = null;
    censorAiDisabledReason = null;
    censorTracks.clear();
    aiCensorDetector.resetModel();
    censorWins = destroyTracked(censorWins);
    return;
  }

  censorOptions = nextOptions;
  censorAiDisabledReason = null;
  censorTracks.clear();
  if (!censorWins.length) {
    censorWins = createDisplayWindows('Smart Censor', {
      transparent: true,
      focusable: false,
      ignoreMouse: true,
      level: 'top',
      backgroundColor: '#00000000',
    });
    for (const win of censorWins) {
      win.setContentProtection(true);
      loadHtml(win, censorPage());
      attachCleanup('censor', win);
    }
  }

  const stats = await updateCensorFrame();
  scheduleCensorLoop();
  raiseWindows(textWins, 'text');
  console.log(`[censor_screen] engine=${stats?.engine || nextOptions.engine} fps=${nextOptions.fps} regions=${stats?.detections || 0} inference=${stats?.inferenceMs || 0}ms`);
  return { ...stats, fps: nextOptions.fps, confidence: nextOptions.confidence };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showText({ text, duration = 15 } = {}) {
  if (!text || !String(text).trim()) throw new Error('show_text requires text');

  if (textTimer) {
    clearTimeout(textTimer);
    textTimer = null;
  }
  textWins = destroyTracked(textWins);

  textWins = createDisplayWindows('Text Message', {
    transparent: true,
    focusable: false,
    ignoreMouse: true,
    level: 'text',
    backgroundColor: '#00000000',
    show: false,
  });

  const html =
    `<!doctype html><html><head><style>` +
    `html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;}` +
    `body{display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif;color:#fff;}` +
    `.msg{max-width:86vw;padding:24px;font-size:clamp(36px,7vw,104px);font-weight:800;` +
    `line-height:1.08;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;` +
    `text-shadow:-3px -3px 0 #000,3px -3px 0 #000,-3px 3px 0 #000,3px 3px 0 #000,0 8px 24px rgba(0,0,0,.9);}` +
    `</style></head><body><div class="msg">${escapeHtml(text)}</div></body></html>`;

  for (const win of textWins) {
    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return;
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      win.showInactive();
      raiseWindows([win], 'text');
    });
    loadHtml(win, html).catch((err) => {
      console.error(`[show_text] failed to load text window: ${err.message}`);
    });
    attachCleanup('text', win);
  }

  textTimer = setTimeout(() => {
    textWins = destroyTracked(textWins);
    textTimer = null;
  }, Math.max(1, Number(duration) || 15) * 1000);
  textTimer.unref?.();
}

function clearTopEffects() {
  hideOverlay();
  blackoutWins = destroyTracked(blackoutWins);
  pixelateWins = destroyTracked(pixelateWins);
  censorWins = destroyTracked(censorWins);
  textWins = destroyTracked(textWins);
  if (blackoutTimer) clearTimeout(blackoutTimer);
  if (textTimer) clearTimeout(textTimer);
  if (censorTimer) clearInterval(censorTimer);
  blackoutTimer = null;
  textTimer = null;
  censorTimer = null;
  censorRunning = false;
  censorOptions = null;
  censorAiDisabledReason = null;
  censorTracks.clear();
  aiCensorDetector.resetModel();
}

module.exports = {
  showOverlay,
  hideOverlay,
  blackoutScreen,
  pixelateScreen,
  censorScreen,
  showText,
  clearTopEffects,
};
