import { globalShortcut } from 'electron'
import { createRequire } from 'module'
import EventBus from './eventbus'
import * as database from './database'
import * as audio from './audio'
import * as screenshot from './screenshot'

const require = createRequire(import.meta.url)

const MODES = ['general', 'interview', 'coding', 'meeting', 'sales']

let uiohook = null
let altHeld = false
let recordingOnHold = false
let mainWindow = null
let currentMode = 'general'

const KEY_ALT_LEFT = 56
const KEY_ALT_RIGHT = 3640
const KEY_Z = 44
const KEY_S = 31
const KEY_H = 35
const KEY_C = 46
const KEY_M = 50

function setMainWindow(win) {
  mainWindow = win
}

function setCurrentMode(mode) {
  currentMode = mode
}

function tryLoadUiohook() {
  try {
    const mod = require('uiohook-napi')
    uiohook = mod.uIOhook
    console.log('[hotkeys] uiohook-napi loaded — hold-to-record enabled')
    return true
  } catch {
    console.warn('[hotkeys] uiohook-napi not available — using globalShortcut fallback (toggle mode)')
    return false
  }
}

function isAlt(keycode) {
  return keycode === KEY_ALT_LEFT || keycode === KEY_ALT_RIGHT
}

function registerUiohookListeners() {
  uiohook.on('keydown', (e) => {
    if (isAlt(e.keycode)) { altHeld = true; return }
    if (!altHeld) return

    switch (e.keycode) {
      case KEY_Z:
        if (!recordingOnHold && !audio.isCurrentlyRecording()) {
          recordingOnHold = true
          audio.startRecording()
          notifyRenderer('hotkey:listen:down')
        }
        break
      case KEY_S: captureAndAnalyze(); break
      case KEY_H: toggleVisibility(); break
      case KEY_C:
        notifyRenderer('hotkey:clear')
        EventBus.emit('app:clear-answer')
        break
      case KEY_M: cycleMode(); break
    }
  })

  uiohook.on('keyup', (e) => {
    if (isAlt(e.keycode)) {
      altHeld = false
      // Alt released while recording — stop immediately (covers Alt-up before Z-up)
      if (recordingOnHold) {
        recordingOnHold = false
        notifyRenderer('hotkey:listen:up')
        audio.stopRecording()
      }
    }
    if (e.keycode === KEY_Z && recordingOnHold) {
      recordingOnHold = false
      notifyRenderer('hotkey:listen:up')
      audio.stopRecording()
    }
  })

  uiohook.start()
  console.log('[hotkeys] uiohook listener active')
}

function registerGlobalShortcutFallbacks() {
  safeRegister('Alt+Z', () => {
    if (audio.isCurrentlyRecording()) {
      audio.stopRecording()
      notifyRenderer('hotkey:listen:up')
    } else {
      audio.startRecording()
      notifyRenderer('hotkey:listen:down')
    }
  })

  safeRegister('Alt+S', () => captureAndAnalyze())
  safeRegister('Alt+H', () => toggleVisibility())
  safeRegister('Alt+C', () => { notifyRenderer('hotkey:clear'); EventBus.emit('app:clear-answer') })
  safeRegister('Alt+M', () => cycleMode())
  safeRegister('Alt+,', () => notifyRenderer('hotkey:settings'))
  safeRegister('Alt+Equal', () => notifyRenderer('hotkey:font-increase'))
  safeRegister('Alt+-', () => notifyRenderer('hotkey:font-decrease'))
  safeRegister('Alt+[', () => notifyRenderer('hotkey:opacity-decrease'))
  safeRegister('Alt+]', () => notifyRenderer('hotkey:opacity-increase'))

  console.log('[hotkeys] globalShortcut fallbacks registered')
}

function safeRegister(accelerator, callback) {
  try {
    globalShortcut.register(accelerator, callback)
  } catch (err) {
    console.warn(`[hotkeys] Could not register ${accelerator}:`, err.message)
  }
}

function cycleMode() {
  const idx = MODES.indexOf(currentMode)
  currentMode = MODES[(idx + 1) % MODES.length]
  database.setSetting('mode', currentMode)
  notifyRenderer('hotkey:mode-change', { mode: currentMode })
  EventBus.emit('app:mode:change', { mode: currentMode })
  console.log(`[hotkeys] Mode changed to: ${currentMode}`)
}

function toggleVisibility() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  // Use CSS opacity (renderer-side) instead of setOpacity() — setOpacity adds WS_EX_LAYERED
  // which breaks SetWindowDisplayAffinity stealth. CSS opacity has no OS-level side effects.
  notifyRenderer('hotkey:visibility-toggle')
}

async function captureAndAnalyze() {
  notifyRenderer('hotkey:screenshot:start')
  try {
    const base64 = await screenshot.captureScreen()
    EventBus.emit('screenshot:ready', { base64 })
    notifyRenderer('hotkey:screenshot:done')
  } catch (err) {
    notifyRenderer('hotkey:screenshot:error', { error: err.message })
  }
}

function notifyRenderer(channel, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

function register(win) {
  mainWindow = win
  currentMode = database.getSetting('mode') || 'general'
  if (tryLoadUiohook()) {
    registerUiohookListeners()
  } else {
    registerGlobalShortcutFallbacks()
  }
}

function unregister() {
  if (uiohook) { try { uiohook.stop() } catch {} }
  globalShortcut.unregisterAll()
}

export { register, unregister, setCurrentMode, setMainWindow }
