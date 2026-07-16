const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const outputDirectory = path.join(__dirname, 'out', 'file-transfer-smoke');
process.env.REMOTE_CONTROL_FILES_DIR = outputDirectory;
const transfers = require('../src/main/fileTransfer');

async function run() {
  await fs.promises.rm(outputDirectory, { recursive: true, force: true });
  const content = Buffer.from('Remote Control file transfer smoke test', 'utf8');
  const transferId = 'smoke-transfer-001';
  await transfers.startTransfer({ transferId, name: '../smoke.txt', size: content.length, mime: 'text/plain' });
  await transfers.writeChunk({ transferId, data: content.subarray(0, 12) });
  await transfers.writeChunk({ transferId, data: content.subarray(12) });
  const result = await transfers.finishTransfer({ transferId });
  const saved = await fs.promises.readFile(result.path);
  if (!saved.equals(content)) throw new Error('Saved file does not match source content');
  if (path.dirname(result.path) !== outputDirectory) throw new Error('File escaped the authorized directory');
  console.log(JSON.stringify({ success: true, name: result.name, size: result.size, directory: outputDirectory }));
}

app.whenReady().then(async () => {
  try {
    await run();
    app.quit();
  } catch (error) {
    console.error(error.stack || error.message);
    app.exit(1);
  }
});
