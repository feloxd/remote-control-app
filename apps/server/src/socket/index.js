const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config');
const initDashHandler = require('./dashHandler');
const initClientHandler = require('./clientHandler');

function initSocket(server) {
  const io = new Server(server, { cors: { origin: config.corsOrigins } });

  const dashNsp = io.of('/dash');
  const clientNsp = io.of('/client');

  dashNsp.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.operator = jwt.verify(token, config.jwtSecret);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  dashNsp.on('connection', (socket) => initDashHandler(io, dashNsp, clientNsp, socket));
  clientNsp.on('connection', (socket) => initClientHandler(io, clientNsp, dashNsp, socket));
}

module.exports = initSocket;
