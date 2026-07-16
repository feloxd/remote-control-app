const express = require('express');
const authMiddleware = require('../middleware/auth');
const { createSession } = require('../db/queries');

const router = express.Router();

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

router.post('/create', authMiddleware, (req, res) => {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const session = createSession(code, expiresAt);
  res.json(session);
});

module.exports = router;
