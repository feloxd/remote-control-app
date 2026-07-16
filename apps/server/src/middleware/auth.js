const jwt = require('jsonwebtoken');
const config = require('../config');

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }
  try {
    req.operator = jwt.verify(header.slice(7), config.jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
