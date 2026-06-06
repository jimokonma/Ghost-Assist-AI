import { desktopCapturer, screen } from 'electron'
import EventBus from './eventbus'

let ghostWindow = null

function setGhostWindow(win) {
  ghostWindow = win
}

async function captureScreen() {
  try {
    console.log('[screenshot] Capturing primary display')

    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.size

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    })

    if (!sources || sources.length === 0) {
      throw new Error('No screen sources found')
    }

    const thumbnail = sources[0].thumbnail
    const pngBuffer = thumbnail.toPNG()
    const base64 = pngBuffer.toString('base64')

    console.log(`[screenshot] Captured ${width}x${height} (${(pngBuffer.length / 1024).toFixed(1)} KB)`)

    return base64
  } catch (err) {
    console.error('[screenshot] Capture failed:', err.message)
    EventBus.emit('screenshot:error', { error: err.message })
    throw err
  }
}

export { setGhostWindow, captureScreen }
