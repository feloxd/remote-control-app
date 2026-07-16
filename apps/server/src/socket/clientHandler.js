const { getSessionByCode, updateSessionStatus } = require('../db/queries');

function initClientHandler(io, clientNsp, dashNsp, socket) {
  console.log(`[client] connected: ${socket.id}`);

  socket.on('join_client', ({ code } = {}) => {
    if (!code) return socket.emit('session_error', { message: 'Código inválido' });

    const session = getSessionByCode(code);
    if (!session) return socket.emit('session_error', { message: 'Código inválido' });
    if (new Date(session.expires_at) < new Date()) {
      return socket.emit('session_error', { message: 'Código expirado' });
    }

    socket.join(code);
    socket.sessionCode = code;
    socket.sessionId   = session.id;

    updateSessionStatus(code, 'active');
    socket.emit('session_joined', { code });
    console.log(`[client] joined session: ${code}`);

    // Notificar al dashboard si el operador ya estaba en la sala
    const dashRoom = dashNsp.adapter.rooms?.get(code);
    if (dashRoom?.size > 0) {
      clientNsp.to(code).emit('session_active');
      dashNsp.to(code).emit('session_active');
    }
  });

  // ACK del cliente tras ejecutar una acción — reenviar al dashboard
  socket.on('action_ack', ({ action, success, error, result }) => {
    if (socket.sessionCode) {
      dashNsp.to(socket.sessionCode).emit('action_ack', { action, success, error, result });
    }
  });

  socket.on('file_transfer_status', (status = {}) => {
    if (socket.sessionCode) dashNsp.to(socket.sessionCode).emit('file_transfer_status', status);
  });

  socket.on('disconnect', () => {
    console.log(`[client] disconnected: ${socket.id}`);
    if (socket.sessionCode) {
      const room = clientNsp.adapter.rooms?.get(socket.sessionCode);
      if (!room || room.size === 0) {
        updateSessionStatus(socket.sessionCode, 'pending');
        dashNsp.to(socket.sessionCode).emit('client_disconnected');
      }
    }
  });
}

module.exports = initClientHandler;
