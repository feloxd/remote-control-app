const { getSessionByCode, updateSessionStatus, logAction } = require('../db/queries');

function initDashHandler(io, dashNsp, clientNsp, socket) {
  console.log(`[dash] operator connected: ${socket.id}`);

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

  socket.on('disconnect', () => {
    console.log(`[dash] operator disconnected: ${socket.id}`);
    if (socket.sessionCode) {
      updateSessionStatus(socket.sessionCode, 'pending');
      clientNsp.to(socket.sessionCode).emit('operator_disconnected');
    }
  });
}

module.exports = initDashHandler;
