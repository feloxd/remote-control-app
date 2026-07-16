const { randomUUID } = require('crypto');
const { getDb } = require('./schema');

function createSession(code, expiresAt) {
  const db = getDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  db.prepare(
    'INSERT INTO sessions (id, code, status, created_at, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, code, 'pending', createdAt, expiresAt);
  return { id, code, status: 'pending', created_at: createdAt, expires_at: expiresAt };
}

function getSessionByCode(code) {
  return getDb().prepare('SELECT * FROM sessions WHERE code = ?').get(code);
}

function updateSessionStatus(code, status) {
  getDb().prepare('UPDATE sessions SET status = ? WHERE code = ?').run(status, code);
}

function logAction(sessionId, action, payload) {
  const db = getDb();
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  db.prepare(
    'INSERT INTO action_logs (id, session_id, action, payload, timestamp) VALUES (?, ?, ?, ?, ?)'
  ).run(id, sessionId, action, JSON.stringify(payload), timestamp);
  return { id, session_id: sessionId, action, payload, timestamp };
}

function getSessionLogs(sessionId) {
  return getDb()
    .prepare('SELECT * FROM action_logs WHERE session_id = ? ORDER BY timestamp ASC')
    .all(sessionId);
}

module.exports = { createSession, getSessionByCode, updateSessionStatus, logAction, getSessionLogs };
