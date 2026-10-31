const { getSessionByCode, updateSessionStatus, logAction } = require('../db/queries');

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_CHUNK_BYTES = 256 * 1024;

function initDashHandler(io, dashNsp, clientNsp, socket) {
  console.log(`[dash] operator connected: ${socket.id}`);
  socket.fileTransfers = new Map();

  socket.on('join_session', (code) => {
    const session = getSessionByCode(code);
    if (!session) return socket.emit('error', { message: 'Session not found' });
    if (new Date(session.expires_at) < new Date()) {
      return socket.emit('error', { message: 'Session expired' });
    }

    socket.join(code);
    socket.sessionCode = code;
    socket.sessionId = session.id;
    socket.emit('session_joined', { code, status: session.status });

    // Activate if client already in room
    const clientRoom = clientNsp.adapter.rooms?.get(code);
    if (clientRoom?.size > 0) {
      updateSessionStatus(code, 'active');
      clientNsp.to(code).emit('session_active');
      dashNsp.to(code).emit('session_active');
    }
  });

  socket.on('dispatch_action', ({ action, payload }) => {
    if (!socket.sessionCode) return socket.emit('error', { message: 'Not in a session' });
    logAction(socket.sessionId, action, payload ?? {});
    clientNsp.to(socket.sessionCode).emit('action', { action, payload });
    socket.emit('action_logged', { action, payload });
  });

  socket.on('file_transfer_start', (metadata = {}) => {
    if (!socket.sessionCode) return socket.emit('file_transfer_status', { transferId: metadata.transferId, state: 'error', error: 'Not in a session' });
    if (!clientNsp.adapter.rooms?.get(socket.sessionCode)?.size) {
      return socket.emit('file_transfer_status', { transferId: metadata.transferId, state: 'error', error: 'Client is not connected' });
    }
    const transferId = String(metadata.transferId || '');
    const size = Number(metadata.size);
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(transferId) || !Number.isInteger(size) || size < 1 || size > MAX_FILE_BYTES) {
      return socket.emit('file_transfer_status', { transferId, state: 'error', error: 'Invalid file metadata' });
    }
    socket.fileTransfers.set(transferId, { size, received: 0 });
    clientNsp.to(socket.sessionCode).emit('file_transfer_start', {
      transferId,
      name: String(metadata.name || 'archivo').slice(0, 240),
      size,
      mime: String(metadata.mime || 'application/octet-stream').slice(0, 120),
    });
    socket.emit('file_transfer_status', { transferId, state: 'sending', sent: 0, total: size });
  });

  socket.on('file_transfer_chunk', ({ transferId, index, data } = {}) => {
    const transfer = socket.fileTransfers.get(transferId);
    if (!transfer || !socket.sessionCode) return;
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data || []);
    if (!chunk.length || chunk.length > MAX_CHUNK_BYTES || transfer.received + chunk.length > transfer.size) {
      socket.fileTransfers.delete(transferId);
      clientNsp.to(socket.sessionCode).emit('file_transfer_cancel', { transferId });
      return socket.emit('file_transfer_status', { transferId, state: 'error', error: 'Invalid file chunk' });
    }
    transfer.received += chunk.length;
    clientNsp.to(socket.sessionCode).emit('file_transfer_chunk', { transferId, index, data: chunk });
  });

  socket.on('file_transfer_end', ({ transferId } = {}) => {
    const transfer = socket.fileTransfers.get(transferId);
    if (!transfer || !socket.sessionCode) return;
    if (transfer.received !== transfer.size) {
      socket.fileTransfers.delete(transferId);
      clientNsp.to(socket.sessionCode).emit('file_transfer_cancel', { transferId });
      return socket.emit('file_transfer_status', { transferId, state: 'error', error: 'Transfer size does not match' });
    }
    socket.fileTransfers.delete(transferId);
    clientNsp.to(socket.sessionCode).emit('file_transfer_end', { transferId });
  });

  socket.on('file_transfer_cancel', ({ transferId } = {}) => {
    socket.fileTransfers.delete(transferId);
    if (socket.sessionCode) clientNsp.to(socket.sessionCode).emit('file_transfer_cancel', { transferId });
  });

  socket.on('disconnect', () => {
    console.log(`[dash] operator disconnected: ${socket.id}`);
    if (socket.sessionCode) {
      for (const transferId of socket.fileTransfers.keys()) {
        clientNsp.to(socket.sessionCode).emit('file_transfer_cancel', { transferId });
      }
      updateSessionStatus(socket.sessionCode, 'pending');
      clientNsp.to(socket.sessionCode).emit('operator_disconnected');
    }
  });
}

module.exports = initDashHandler;
