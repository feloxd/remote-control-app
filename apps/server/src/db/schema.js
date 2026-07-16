const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/remote_control.db');

let db;

function getDb() {
  if (!db) {
    const resolved = path.resolve(DB_PATH);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    db = new DatabaseSync(resolved);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

function initDb() {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      code       TEXT UNIQUE NOT NULL,
      status     TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS action_logs (
      id         TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      action     TEXT NOT NULL,
      payload    TEXT,
      timestamp  TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id)
    );
  `);
  console.log(`Database initialized at ${path.resolve(DB_PATH)}`);
}

module.exports = { getDb, initDb };
