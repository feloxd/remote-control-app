const { desktopCapturer, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

function outputDir() {
  const candidates = [
    path.join(os.homedir(), 'Pictures', 'Remote Control Screenshots'),
    path.join(os.homedir(), 'Desktop'),
    os.tmpdir(),
  ];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return dir;
    } catch {
      // try next candidate
    }
  }
  throw new Error('No writable screenshot directory available');
}

async function takeScreenshot() {
  const displays = screen.getAllDisplays();
  const maxWidth = Math.max(...displays.map((display) => display.bounds.width));
  const maxHeight = Math.max(...displays.map((display) => display.bounds.height));

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: maxWidth, height: maxHeight },
  });

  if (!sources.length) throw new Error('No screen source available');

  const dir = outputDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const paths = displays.map((display, index) => {
    const source =
      sources.find((item) => String(item.display_id) === String(display.id)) ||
      sources[index] ||
      sources[0];
    const filePath = path.join(dir, `screenshot-${timestamp}-display-${index + 1}.png`);
    fs.writeFileSync(filePath, source.thumbnail.toPNG());
    return filePath;
  });

  return paths;
}

module.exports = { takeScreenshot };
