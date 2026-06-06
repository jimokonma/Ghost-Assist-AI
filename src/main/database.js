import { createRequire } from 'module'
import path from 'path'
import { app } from 'electron'
import fs from 'fs'

// node-sqlite3-wasm sets module.exports dynamically (WASM init), which
// breaks Node.js ESM static pre-parse. Load it via createRequire instead.
const require = createRequire(import.meta.url)
const { Database } = require('node-sqlite3-wasm')

let db = null

function getDbPath() {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'data.db')
}

function init() {
  const dbPath = getDbPath()
  const dir = path.dirname(dbPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

  // node-sqlite3-wasm uses a .lock directory as a file-system mutex.
  // If the previous Electron instance was force-killed, this directory is left
  // behind and blocks the next open. Safe to remove on startup since we are
  // the only instance starting right now.
  const lockPath = `${dbPath}.lock`
  if (fs.existsSync(lockPath)) {
    try { fs.rmdirSync(lockPath) } catch {}
  }

  db = new Database(dbPath)
  db.exec('PRAGMA foreign_keys = ON')
  createSchema()
  seedDefaultSettings()
  return db
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      mode TEXT DEFAULT 'general',
      duration_seconds INTEGER DEFAULT 0,
      question_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS exchanges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER REFERENCES sessions(id) ON DELETE CASCADE,
      question_text TEXT,
      answer_text TEXT,
      screenshot_path TEXT,
      response_time_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_base (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      content_text TEXT,
      chunk_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS audio_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      device_name TEXT,
      device_id TEXT,
      is_default INTEGER DEFAULT 0
    );
  `)
}

function seedDefaultSettings() {
  const defaults = {
    mode: 'general',
    hotkey_listen: 'Alt+Z',
    hotkey_screenshot: 'Alt+S',
    hotkey_toggle: 'Alt+H',
    hotkey_clear: 'Alt+C',
    hotkey_settings: 'Alt+,',
    hotkey_mode: 'Alt+M',
    opacity: '85',
    font_size: '14',
    window_x: '20',
    window_y: '20',
    window_width: '420',
    window_height: '600',
    whisper_model: 'whisper-1',
    claude_model: 'claude-sonnet-4-6',
    max_answer_words: '300',
    context_exchanges: '3'
  }

  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)')
  for (const [key, value] of Object.entries(defaults)) {
    insert.run([key, value])
  }
  insert.finalize()
}

function createSession(mode) {
  const stmt = db.prepare('INSERT INTO sessions (mode) VALUES (?)')
  const result = stmt.run(mode)
  return result.lastInsertRowid
}

function closeSession(sessionId, durationSeconds) {
  db.run('UPDATE sessions SET duration_seconds = ? WHERE id = ?', [durationSeconds, sessionId])
}

function getSessions(limit = 50) {
  return db.prepare('SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?').all(limit)
}

function getSession(sessionId) {
  return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId)
}

function saveExchange({ sessionId, questionText, answerText, screenshotPath, responseTimeMs }) {
  const result = db.run(
    'INSERT INTO exchanges (session_id, question_text, answer_text, screenshot_path, response_time_ms) VALUES (?, ?, ?, ?, ?)',
    [sessionId, questionText, answerText || '', screenshotPath || null, responseTimeMs || 0]
  )
  db.run('UPDATE sessions SET question_count = question_count + 1 WHERE id = ?', [sessionId])
  return result.lastInsertRowid
}

function getExchanges(sessionId) {
  return db.prepare('SELECT * FROM exchanges WHERE session_id = ? ORDER BY created_at ASC').all(sessionId)
}

function getRecentExchanges(sessionId, limit = 3) {
  return db.all('SELECT * FROM exchanges WHERE session_id = ? ORDER BY created_at DESC LIMIT ?', [sessionId, limit])
}

function getSetting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : null
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)])
}

function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

function addKnowledgeBase(filename, contentText) {
  const chunkSize = 500
  const chunks = []
  for (let i = 0; i < contentText.length; i += chunkSize) {
    chunks.push(contentText.slice(i, i + chunkSize))
  }
  db.run('DELETE FROM knowledge_base WHERE filename = ?', [filename])
  const insert = db.prepare('INSERT INTO knowledge_base (filename, content_text, chunk_index) VALUES (?, ?, ?)')
  chunks.forEach((chunk, idx) => insert.run([filename, chunk, idx]))
  insert.finalize()
  return chunks.length
}

function getKnowledgeBase() {
  const rows = db.prepare('SELECT content_text FROM knowledge_base ORDER BY filename, chunk_index').all()
  return rows.map((r) => r.content_text).join('\n\n')
}

function listKnowledgeBaseFiles() {
  return db.prepare('SELECT DISTINCT filename FROM knowledge_base ORDER BY filename').all()
}

function deleteKnowledgeBaseFile(filename) {
  db.prepare('DELETE FROM knowledge_base WHERE filename = ?').run(filename)
}

function clearAllData() {
  db.exec('DELETE FROM exchanges; DELETE FROM sessions; DELETE FROM knowledge_base;')
}

function close() {
  if (db && db.isOpen) {
    db.close()
    db = null
  }
}

export {
  init, close, createSession, closeSession, getSessions, getSession,
  saveExchange, getExchanges, getRecentExchanges,
  getSetting, setSetting, getAllSettings,
  addKnowledgeBase, getKnowledgeBase, listKnowledgeBaseFiles, deleteKnowledgeBaseFile,
  clearAllData
}
