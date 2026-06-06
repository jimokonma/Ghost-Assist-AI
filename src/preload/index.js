/**
 * Preload script — context bridge between main and renderer.
 * Exposes a minimal, typed API surface via window.ghostassist.
 * Every exposed function validates its own arguments before crossing the bridge.
 */

const { contextBridge, ipcRenderer } = require('electron')

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireString(val, maxLen, label) {
  if (typeof val !== 'string') throw new TypeError(`${label} must be a string`)
  if (val.length > maxLen) throw new RangeError(`${label} exceeds max length (${maxLen})`)
  return val
}

function requirePositiveInt(val, label) {
  const n = parseInt(val, 10)
  if (!Number.isInteger(n) || n <= 0) throw new TypeError(`${label} must be a positive integer`)
  return n
}

// ── Allowed inbound IPC channels ──────────────────────────────────────────────

const ALLOWED_CHANNELS = new Set([
  'claude:token',
  'claude:complete',
  'transcript:ready',
  'status:transcribing',
  'status:analyzing',
  'status:responding',
  'answer:clear',
  'error',
  'audio:start-recording',
  'audio:stop-recording',
  'hotkey:listen:down',
  'hotkey:listen:up',
  'hotkey:screenshot:start',
  'hotkey:screenshot:done',
  'hotkey:screenshot:error',
  'hotkey:clear',
  'hotkey:settings',
  'hotkey:mode-change',
  'hotkey:visibility-toggle',
  'hotkey:font-increase',
  'hotkey:font-decrease',
  'hotkey:opacity-increase',
  'hotkey:opacity-decrease'
])

// ── Exposed API ───────────────────────────────────────────────────────────────

contextBridge.exposeInMainWorld('ghostassist', {
  // ── Settings ───────────────────────────────────────────────────────────────
  settings: {
    getAll: () => ipcRenderer.invoke('settings:get-all'),
    set: (key, value) => {
      requireString(key, 64, 'key')
      requireString(String(value ?? ''), 512, 'value')
      return ipcRenderer.invoke('settings:set', { key, value })
    }
  },

  // ── Query ──────────────────────────────────────────────────────────────────
  query: {
    text: (text) => {
      requireString(text, 4000, 'text')
      return ipcRenderer.invoke('query:text', { text })
    }
  },

  // ── Audio ──────────────────────────────────────────────────────────────────
  audio: {
    sendBlob: (base64, mimeType) => {
      requireString(base64, 40_000_000, 'base64')
      requireString(mimeType, 100, 'mimeType')
      ipcRenderer.send('audio:blob', { base64, mimeType })
    }
  },

  // ── Screenshot ─────────────────────────────────────────────────────────────
  screenshot: {
    capture: () => ipcRenderer.invoke('screenshot:capture')
  },

  // ── History ────────────────────────────────────────────────────────────────
  history: {
    getSessions: (limit = 50) => {
      const n = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500)
      return ipcRenderer.invoke('history:get-sessions', { limit: n })
    },
    getExchanges: (sessionId) => {
      requirePositiveInt(sessionId, 'sessionId')
      return ipcRenderer.invoke('history:get-exchanges', { sessionId })
    }
  },

  // ── Knowledge Base ─────────────────────────────────────────────────────────
  knowledgeBase: {
    upload: (filename, content) => {
      requireString(filename, 255, 'filename')
      requireString(content, 500_000, 'content')
      return ipcRenderer.invoke('knowledge-base:upload', { filename, content })
    },
    list:       ()         => ipcRenderer.invoke('knowledge-base:list'),
    delete:     (filename) => {
      requireString(filename, 255, 'filename')
      return ipcRenderer.invoke('knowledge-base:delete', { filename })
    },
    openDialog: ()         => ipcRenderer.invoke('knowledge-base:open-dialog')
  },

  // ── API Keys ───────────────────────────────────────────────────────────────
  apiKeys: {
    status: () => ipcRenderer.invoke('apikeys:status'),
    set: (name, value) => {
      requireString(name, 50, 'name')
      requireString(value, 1000, 'value')
      return ipcRenderer.invoke('apikeys:set', { name, value })
    },
    remove: (name) => {
      requireString(name, 50, 'name')
      return ipcRenderer.invoke('apikeys:remove', { name })
    }
  },

  // ── Data ───────────────────────────────────────────────────────────────────
  data: {
    clearAll: () => ipcRenderer.invoke('data:clear-all')
  },

  // ── Window ─────────────────────────────────────────────────────────────────
  window: {
    close:    () => ipcRenderer.send('window:close'),
    minimize: () => ipcRenderer.send('window:minimize')
  },

  // ── IPC Listeners ──────────────────────────────────────────────────────────
  on: (channel, callback) => {
    if (!ALLOWED_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked IPC channel: ${channel}`)
      return () => {}
    }
    if (typeof callback !== 'function') throw new TypeError('callback must be a function')

    const handler = (_, data) => callback(data)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  }
})
