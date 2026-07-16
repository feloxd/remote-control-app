const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { once } = require('events');

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_CHUNK_BYTES = 256 * 1024;
const transfers = new Map();

function safeFileName(value) {
  const name = path.basename(String(value || 'archivo'))
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/[. ]+$/, '')
    .slice(0, 180);
  return name || 'archivo';
}

function uniqueDestination(directory, fileName) {
  const parsed = path.parse(fileName);
  let destination = path.join(directory, fileName);
  let index = 1;
  while (fs.existsSync(destination)) {
    destination = path.join(directory, `${parsed.name} (${index})${parsed.ext}`);
    index += 1;
  }
  return destination;
}

async function startTransfer({ transferId, name, size, mime } = {}) {
  if (!/^[a-zA-Z0-9-]{8,80}$/.test(String(transferId || ''))) throw new Error('Invalid transfer ID');
  const expectedSize = Number(size);
  if (!Number.isInteger(expectedSize) || expectedSize < 1 || expectedSize > MAX_FILE_BYTES) {
    throw new Error('File must be between 1 byte and 25 MB');
  }
  if (transfers.has(transferId)) throw new Error('Transfer already exists');

  const directory = process.env.REMOTE_CONTROL_FILES_DIR
    ? path.resolve(process.env.REMOTE_CONTROL_FILES_DIR)
    : path.join(app.getPath('downloads'), 'Remote Control Files');
  await fs.promises.mkdir(directory, { recursive: true });
  const fileName = safeFileName(name);
  const destination = uniqueDestination(directory, fileName);
  const temporaryPath = `${destination}.${transferId}.part`;
  const stream = fs.createWriteStream(temporaryPath, { flags: 'wx' });

  transfers.set(transferId, {
    transferId,
    name: path.basename(destination),
    mime: String(mime || 'application/octet-stream'),
    expectedSize,
    receivedSize: 0,
    destination,
    temporaryPath,
    stream,
  });
  return { transferId, name: path.basename(destination), directory };
}

async function writeChunk({ transferId, data } = {}) {
  const transfer = transfers.get(transferId);
  if (!transfer) throw new Error('Unknown transfer');
  const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
  if (!chunk.length || chunk.length > MAX_CHUNK_BYTES) throw new Error('Invalid file chunk');
  if (transfer.receivedSize + chunk.length > transfer.expectedSize) throw new Error('Transfer exceeds declared size');
  if (!transfer.stream.write(chunk)) await once(transfer.stream, 'drain');
  transfer.receivedSize += chunk.length;
  return { transferId, received: transfer.receivedSize, total: transfer.expectedSize };
}

async function finishTransfer({ transferId } = {}) {
  const transfer = transfers.get(transferId);
  if (!transfer) throw new Error('Unknown transfer');
  if (transfer.receivedSize !== transfer.expectedSize) {
    await abortTransfer(transferId);
    throw new Error('Transfer size does not match');
  }
  await new Promise((resolve, reject) => {
    transfer.stream.once('error', reject);
    transfer.stream.end(resolve);
  });
  await fs.promises.rename(transfer.temporaryPath, transfer.destination);
  transfers.delete(transferId);
  return { transferId, name: transfer.name, path: transfer.destination, size: transfer.receivedSize };
}

async function abortTransfer(transferId) {
  const transfer = transfers.get(transferId);
  if (!transfer) return;
  transfers.delete(transferId);
  transfer.stream.destroy();
  await fs.promises.rm(transfer.temporaryPath, { force: true }).catch(() => {});
}

async function abortAllTransfers() {
  await Promise.all([...transfers.keys()].map(abortTransfer));
}

module.exports = {
  MAX_FILE_BYTES,
  MAX_CHUNK_BYTES,
  startTransfer,
  writeChunk,
  finishTransfer,
  abortTransfer,
  abortAllTransfers,
};
