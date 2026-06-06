import EventBus from './eventbus'

const MIN_DURATION_MS = 300

let isRecording = false
let recordingStartTime = null
let mainWindow = null

function setMainWindow(win) {
  mainWindow = win
}

function startRecording() {
  if (isRecording) return
  isRecording = true
  recordingStartTime = Date.now()

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('audio:start-recording')
  }

  EventBus.emit('audio:recording:start')
  console.log('[audio] Recording started')
}

function stopRecording() {
  if (!isRecording) return
  isRecording = false

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('audio:stop-recording')
  }

  console.log('[audio] Recording stopped, awaiting blob from renderer')
}

function handleAudioBlob(base64Audio, mimeType) {
  const duration = Date.now() - (recordingStartTime || Date.now())

  if (duration < MIN_DURATION_MS) {
    console.log('[audio] Recording too short — discarded')
    EventBus.emit('audio:too-short')
    return
  }

  const buffer = Buffer.from(base64Audio, 'base64')
  console.log(`[audio] Audio ready (${(buffer.length / 1024).toFixed(1)} KB, ${duration}ms)`)

  EventBus.emit('audio:recording:complete', { buffer, mimeType, durationMs: duration })
}

function isCurrentlyRecording() {
  return isRecording
}

export { setMainWindow, startRecording, stopRecording, handleAudioBlob, isCurrentlyRecording }
