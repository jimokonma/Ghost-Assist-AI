/**
 * GhostAssist AI — Main Process Entry Point
 * Coordinates all agents via EventBus: Audio → Transcription → Claude → UI
 */

import './env-loader'

import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from 'electron'

// Transparent overlay windows on Windows need DWM composition (not swiftshader).
// WDA_EXCLUDEFROMCAPTURE is incompatible with WS_EX_LAYERED (transparent windows),
// so we rely on setContentProtection (WDA_MONITOR) for screen-capture protection instead.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disable-features', 'HardwareMediaKeyHandling,MediaSessionService')
}
import path from 'path'
import fs from 'fs'

import EventBus from './eventbus'
import * as database from './database'
import * as stealth from './stealth'
import * as audio from './audio'
import * as transcription from './transcription'
import * as screenshot from './screenshot'
import * as claudeAgent from './claude'
import * as hotkeys from './hotkeys'
import * as apikeys from './apikeys'

let mainWindow = null
let tray = null
let currentSessionId = null
let sessionStartTime = null
let currentMode = 'general'

// 16x16 ghost icon embedded as base64 so it works in dev + packaged builds
const TRAY_ICON_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAA' +
  'AXNSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAwklEQVQ4y2NgYGD4z0ABYBo1gAIw6oUhYIAB' +
  'AAD//wMABQAC/yMAAAAASUVORK5CYII='

function createTray() {
  const icon = nativeImage.createFromDataURL(`data:image/png;base64,${TRAY_ICON_B64}`)
    .resize({ width: 16, height: 16 })

  tray = new Tray(icon)
  tray.setToolTip('GhostAssist AI')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show GhostAssist',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ])

  tray.setContextMenu(menu)
  tray.on('double-click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

// ─── Input validation ─────────────────────────────────────────────────────────

const MAX_QUERY_LEN        = 4_000
const MAX_KB_CONTENT_LEN   = 500_000   // 500 KB per knowledge-base file
const MAX_AUDIO_B64_LEN    = 40_000_000 // ~30 MB encoded audio
const MAX_FILENAME_LEN     = 255

const ALLOWED_SETTINGS_KEYS = new Set([
  'mode', 'hotkey_listen', 'hotkey_screenshot', 'hotkey_toggle', 'hotkey_clear',
  'hotkey_settings', 'hotkey_mode', 'opacity', 'font_size', 'window_x', 'window_y',
  'window_width', 'window_height', 'whisper_model', 'claude_model',
  'max_answer_words', 'context_exchanges'
])

function assertStr(val, maxLen, label = 'value') {
  if (typeof val !== 'string') throw new Error(`${label} must be a string`)
  if (val.length > maxLen) throw new Error(`${label} exceeds maximum length (${maxLen})`)
  return val
}

function sanitizeQuery(text) {
  // Strip ASCII control chars except tab (9) and newlines (10, 13)
  return text.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim()
}

// ─── Window security hardening ────────────────────────────────────────────────

function wireWindowSecurity(win) {
  // Content Security Policy — locks down what the renderer can load
  win.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "connect-src 'self'; " +
          "img-src 'self' data:; " +
          "media-src 'none'; " +
          "object-src 'none'; " +
          "base-uri 'self'; " +
          "form-action 'none'"
        ],
        'X-Content-Type-Options': ['nosniff'],
        'X-Frame-Options': ['DENY']
      }
    })
  })

  // Block any attempt to navigate away from the local app bundle
  win.webContents.on('will-navigate', (e, url) => {
    const safe =
      url.startsWith('http://localhost:5173') ||
      url.startsWith('file://') ||
      url.startsWith('devtools://')
    if (!safe) {
      e.preventDefault()
      console.warn('[security] Blocked navigation to:', url)
    }
  })

  // Block target=_blank / window.open() from the renderer
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.warn('[security] Blocked new-window request:', url)
    return { action: 'deny' }
  })

  // Prevent DevTools in packaged builds
  if (app.isPackaged) {
    win.webContents.on('devtools-opened', () => {
      win.webContents.closeDevTools()
      console.warn('[security] DevTools blocked in production')
    })
  }
}

// ─── Dev URL Loader (with retry until Vite is ready) ─────────────────────────

async function loadDevURL(win, attempt = 1) {
  if (!win || win.isDestroyed()) return
  try {
    await win.loadURL('http://localhost:5173')
  } catch {
    if (attempt >= 20) {
      console.error('[main] Vite dev server unreachable after 20 attempts')
      return
    }
    setTimeout(() => loadDevURL(win, attempt + 1), 500)
  }
}

// ─── Window Creation ───────────────────────────────────────────────────────────

function createWindow() {
  database.init()
  currentMode = database.getSetting('mode') || 'general'

  const savedX = parseInt(database.getSetting('window_x') || '20', 10)
  const savedY = parseInt(database.getSetting('window_y') || '20', 10)
  const savedW = parseInt(database.getSetting('window_width') || '420', 10)
  const savedH = parseInt(database.getSetting('window_height') || '600', 10)

  mainWindow = new BrowserWindow({
    x: savedX,
    y: savedY,
    width: savedW,
    height: savedH,
    minWidth: 380,
    minHeight: 200,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  wireWindowSecurity(mainWindow)

  mainWindow.once('ready-to-show', () => {
    stealth.makeWindowStealth(mainWindow)
    mainWindow.show()
    startNewSession()
  })

  // Re-apply on every state change — Electron silently resets the WDA flag
  ;['show', 'restore', 'focus'].forEach(event => {
    mainWindow.on(event, () => stealth.makeWindowStealth(mainWindow))
  })

  mainWindow.on('moved', saveWindowBounds)
  mainWindow.on('resized', saveWindowBounds)

  mainWindow.on('closed', () => {
    closeCurrentSession()
    mainWindow = null
  })

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    loadDevURL(mainWindow)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../out/renderer/index.html'))
  }

  audio.setMainWindow(mainWindow)
  screenshot.setGhostWindow(mainWindow)
  hotkeys.register(mainWindow)
  wireEventBus()
  createTray()
}

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const bounds = mainWindow.getBounds()
  database.setSetting('window_x', bounds.x)
  database.setSetting('window_y', bounds.y)
  database.setSetting('window_width', bounds.width)
  database.setSetting('window_height', bounds.height)
}

// ─── Session Management ────────────────────────────────────────────────────────

function startNewSession() {
  currentSessionId = database.createSession(currentMode)
  sessionStartTime = Date.now()
  console.log(`[main] Session started: #${currentSessionId} (${currentMode})`)
}

function closeCurrentSession() {
  if (!currentSessionId) return
  const duration = Math.floor((Date.now() - (sessionStartTime || Date.now())) / 1000)
  database.closeSession(currentSessionId, duration)
  console.log(`[main] Session #${currentSessionId} closed (${duration}s)`)
  currentSessionId = null
}

// ─── EventBus → IPC Pipeline ───────────────────────────────────────────────────

function wireEventBus() {
  EventBus.on('audio:recording:complete', async ({ buffer, mimeType, durationMs }) => {
    // Renderer already shows "Thinking…" from the keyup event — don't override it
    try {
      const text = await transcription.transcribeAudio({ buffer, mimeType, durationMs })
      sendToRenderer('transcript:ready', { text })
      await claudeAgent.getResponse({ question: text, mode: currentMode, sessionId: currentSessionId })
    } catch (err) {
      sendToRenderer('error', { message: `Transcription failed: ${err.message}` })
    }
  })

  EventBus.on('audio:too-short', () => sendToRenderer('answer:clear'))

  EventBus.on('screenshot:ready', async ({ base64 }) => {
    sendToRenderer('status:analyzing')
    try {
      await claudeAgent.getResponse({
        question: null,
        mode: currentMode,
        screenshot: base64,
        sessionId: currentSessionId
      })
    } catch (err) {
      sendToRenderer('error', { message: `Vision analysis failed: ${err.message}` })
    }
  })

  EventBus.on('claude:token', ({ text }) => sendToRenderer('claude:token', { text }))
  EventBus.on('claude:complete', (data) => sendToRenderer('claude:complete', data))
  EventBus.on('claude:error', ({ error }) => sendToRenderer('error', { message: error }))
  EventBus.on('claude:start', () => sendToRenderer('status:responding'))

  EventBus.on('app:mode:change', ({ mode }) => {
    currentMode = mode
    if (currentSessionId) {
      closeCurrentSession()
      startNewSession()
    }
  })

  EventBus.on('app:clear-answer', () => sendToRenderer('answer:clear'))
}

function sendToRenderer(channel, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers() {
  // ── Audio ──────────────────────────────────────────────────────────────────
  ipcMain.on('audio:blob', (_, { base64, mimeType }) => {
    try {
      const b64  = assertStr(base64, MAX_AUDIO_B64_LEN, 'audio base64')
      const mime = assertStr(mimeType, 100, 'mimeType')
      if (!mime.startsWith('audio/')) throw new Error('Invalid mimeType')
      audio.handleAudioBlob(b64, mime)
    } catch (err) {
      console.warn('[security] audio:blob rejected:', err.message)
    }
  })

  // ── Text query ─────────────────────────────────────────────────────────────
  ipcMain.handle('query:text', async (_, { text }) => {
    try {
      const clean = sanitizeQuery(assertStr(text, MAX_QUERY_LEN, 'query text'))
      if (!clean) return { success: false, error: 'Empty query' }
      sendToRenderer('status:responding')
      await claudeAgent.getResponse({ question: clean, mode: currentMode, sessionId: currentSessionId })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Settings ───────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get-all', () => database.getAllSettings())

  ipcMain.handle('settings:set', (_, { key, value }) => {
    try {
      const k = assertStr(key, 64, 'settings key')
      const v = assertStr(String(value ?? ''), 512, 'settings value')
      if (!ALLOWED_SETTINGS_KEYS.has(k)) throw new Error(`Unknown settings key: ${k}`)
      database.setSetting(k, v)
      if (k === 'mode') { currentMode = v; hotkeys.setCurrentMode(v) }
      return { success: true }
    } catch (err) {
      console.warn('[security] settings:set rejected:', err.message)
      return { success: false, error: err.message }
    }
  })

  // ── History ────────────────────────────────────────────────────────────────
  ipcMain.handle('history:get-sessions', (_, { limit } = {}) => {
    const safeLimit = Math.min(Math.max(parseInt(limit ?? 50, 10) || 50, 1), 500)
    return database.getSessions(safeLimit)
  })

  ipcMain.handle('history:get-exchanges', (_, { sessionId }) => {
    const id = parseInt(sessionId, 10)
    if (!Number.isInteger(id) || id <= 0) return []
    return database.getExchanges(id)
  })

  // ── Knowledge base ─────────────────────────────────────────────────────────
  ipcMain.handle('knowledge-base:upload', async (_, { filename, content }) => {
    try {
      const fname = assertStr(path.basename(String(filename)), MAX_FILENAME_LEN, 'filename')
      const text  = assertStr(content, MAX_KB_CONTENT_LEN, 'content')
      const chunks = database.addKnowledgeBase(fname, text)
      return { success: true, chunks }
    } catch (err) {
      console.warn('[security] knowledge-base:upload rejected:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('knowledge-base:list', () => database.listKnowledgeBaseFiles())

  ipcMain.handle('knowledge-base:delete', (_, { filename }) => {
    try {
      const fname = assertStr(path.basename(String(filename)), MAX_FILENAME_LEN, 'filename')
      database.deleteKnowledgeBaseFile(fname)
      return { success: true }
    } catch (err) {
      console.warn('[security] knowledge-base:delete rejected:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('knowledge-base:open-dialog', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Upload to Knowledge Base',
      filters: [
        { name: 'Documents', extensions: ['txt', 'md', 'pdf', 'doc', 'docx'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    })

    if (result.canceled || !result.filePaths.length) return { canceled: true }

    const files = []
    for (const filePath of result.filePaths) {
      try {
        // Ensure the resolved path stays within the user's readable directories
        const resolved = path.resolve(filePath)
        const content  = fs.readFileSync(resolved, 'utf-8')
        const filename = path.basename(resolved)
        if (content.length > MAX_KB_CONTENT_LEN) throw new Error('File too large (max 500 KB)')
        const chunks = database.addKnowledgeBase(filename, content)
        files.push({ filename, chunks })
      } catch (err) {
        console.error(`[main] Failed to read ${filePath}:`, err.message)
      }
    }
    return { success: true, files }
  })

  // ── Data ───────────────────────────────────────────────────────────────────
  ipcMain.handle('data:clear-all', () => {
    database.clearAllData()
    claudeAgent.clearHistory()
    return { success: true }
  })

  // ── API Keys (safeStorage encrypted) ──────────────────────────────────────
  ipcMain.handle('apikeys:status', () => {
    try { return apikeys.getStatus() }
    catch (err) {
      console.error('[apikeys] status error:', err.message)
      return { anthropic: 'not_set', openai: 'not_set', encryption: 'error' }
    }
  })

  ipcMain.handle('apikeys:set', (_, { name, value }) => {
    try {
      const n = assertStr(name, 50, 'name')
      if (!['anthropic', 'openai'].includes(n)) throw new Error('Unknown key name')
      const v = assertStr(value, 1000, 'value').trim()
      if (!v) throw new Error('API key cannot be empty')
      apikeys.setApiKey(n, v)
      // Invalidate cached clients so they re-initialise with the new key
      claudeAgent.resetClient()
      transcription.resetClient()
      return { success: true }
    } catch (err) {
      console.warn('[security] apikeys:set rejected:', err.message)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('apikeys:remove', (_, { name }) => {
    try {
      const n = assertStr(name, 50, 'name')
      if (!['anthropic', 'openai'].includes(n)) throw new Error('Unknown key name')
      apikeys.removeApiKey(n)
      claudeAgent.resetClient()
      transcription.resetClient()
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })

  // ── Window ─────────────────────────────────────────────────────────────────
  ipcMain.on('window:close', () => app.quit())
  ipcMain.on('window:minimize', () => mainWindow?.hide())

  // ── Screenshot ─────────────────────────────────────────────────────────────
  ipcMain.handle('screenshot:capture', async () => {
    try {
      const base64 = await screenshot.captureScreen()
      EventBus.emit('screenshot:ready', { base64 })
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    }
  })
}

// ─── App Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()
})

app.on('window-all-closed', () => {
  hotkeys.unregister()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeCurrentSession()
  hotkeys.unregister()
  database.close()
})

app.on('activate', () => {
  if (!mainWindow) createWindow()
})
