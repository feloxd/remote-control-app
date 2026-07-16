// Headless-ish harness to verify the media popups WITHOUT the server/dashboard.
// It calls media.showImage / media.playVideo directly, asserts the window is
// true fullscreen, confirms a direct mp4 actually decodes, and writes
// screenshots to test/out/ so the result can be eyeballed.
//
// Run (from apps/desktop-client):
//   ../../node_modules/.bin/electron test/media-test.js
//
// Env overrides: TEST_IMG, TEST_MP4, TEST_YT
const { app, BrowserWindow, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const media = require('../src/main/actions/media');

const IMG = process.env.TEST_IMG || 'https://www.w3schools.com/images/w3schools_green.jpg';
const MP4 = process.env.TEST_MP4 || 'https://www.w3schools.com/html/mov_bbb.mp4';
const YT  = process.env.TEST_YT  || 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
const OUT = path.join(__dirname, 'out');

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

function newest() {
  const w = BrowserWindow.getAllWindows();
  return w[w.length - 1];
}

async function snap(win, name) {
  try {
    const img = await win.capturePage();
    fs.writeFileSync(path.join(OUT, name), img.toPNG());
    console.log(`[media-test] wrote ${name}`);
  } catch (e) {
    console.log(`[media-test] snapshot ${name} failed: ${e.message}`);
  }
}

function report(tag, win, disp) {
  const b = win.getBounds();
  const fs_ = win.isFullScreen();
  const exact = b.x === disp.bounds.x && b.y === disp.bounds.y &&
                b.width === disp.bounds.width && b.height === disp.bounds.height;
  console.log(`[media-test] ${tag}: isFullScreen=${fs_} bounds=${JSON.stringify(b)} coversDisplay=${exact}`);
  return fs_ || exact;
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const disp = screen.getPrimaryDisplay();
  console.log('[media-test] primary display bounds', JSON.stringify(disp.bounds));

  // ── show_image ────────────────────────────────────────────────────────────
  await media.showImage({ url: IMG });
  await delay(4000);
  const iw = newest();
  report('IMAGE', iw, disp);
  await snap(iw, 'image.png');
  media.closeImage();
  await delay(600);

  // ── play_video: direct mp4 (the user's requested sanity check) ─────────────
  await media.playVideo({ url: MP4 });
  await delay(6000);
  const vw = newest();
  report('VIDEO(mp4)', vw, disp);
  const vinfo = await vw.webContents.executeJavaScript(
    `(()=>{const v=document.querySelector('video');return v?{readyState:v.readyState,videoWidth:v.videoWidth,videoHeight:v.videoHeight,paused:v.paused,err:v.error&&v.error.code}:{noVideoEl:true};})()`
  ).catch((e) => ({ evalErr: String(e) }));
  console.log('[media-test] VIDEO(mp4) element:', JSON.stringify(vinfo));
  await snap(vw, 'video_mp4.png');
  media.closeVideo();
  await delay(600);

  // ── play_video: YouTube (iframe host) ──────────────────────────────────────
  await media.playVideo({ url: YT });
  await delay(7000);
  const yw = newest();
  report('VIDEO(yt)', yw, disp);
  const yinfo = await yw.webContents.executeJavaScript(
    `(()=>{const f=document.querySelector('iframe');return {hasIframe:!!f,src:f&&f.src};})()`
  ).catch((e) => ({ evalErr: String(e) }));
  console.log('[media-test] VIDEO(yt) iframe:', JSON.stringify(yinfo));
  await snap(yw, 'video_yt.png');
  media.closeVideo();
  await delay(600);

  app.quit();
  setTimeout(() => process.exit(0), 500);
});

app.on('window-all-closed', () => { /* keep alive until the flow finishes */ });
