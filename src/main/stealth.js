/**
 * Stealth window — makes the overlay invisible to all screen capture APIs.
 *
 * Root cause on Windows: Electron 34.x sets WS_EX_LAYERED on all BrowserWindows
 * for GPU-accelerated compositing. WS_EX_LAYERED is incompatible with
 * SetWindowDisplayAffinity (non-zero values fail with ERROR_NOT_ENOUGH_MEMORY).
 *
 * Fix: launch with --use-gl=swiftshader (software rendering). This removes
 * WS_EX_LAYERED, allowing SetWindowDisplayAffinity(WDA_EXCLUDEFROMCAPTURE) to work.
 * See index.js for where the flag is applied.
 *
 * SetWindowDisplayAffinity MUST be called from WITHIN the process that owns the
 * window. Cross-process calls (e.g. PowerShell) are silently rejected by Windows.
 * koffi provides in-process FFI without requiring VS Build Tools.
 */

import os from 'os'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

const WDA_NONE             = 0x00000000
const WDA_EXCLUDEFROMCAPTURE = 0x00000011

let setAffinity = null
let stealthMethod = null

// ─── Method 1: koffi (pre-built, no compilation) ───────────────────────────

function tryLoadKoffi() {
  if (setAffinity) return true
  if (!isWindows19041()) return false
  try {
    const koffi = require('koffi')
    const user32   = koffi.load('user32.dll')
    const kernel32 = koffi.load('kernel32.dll')

    const setWDA     = user32.func('int SetWindowDisplayAffinity(uint32 hWnd, uint32 dwAffinity)')
    const setLastErr = kernel32.func('void SetLastError(uint32 dwErrCode)')
    const getLastErr = kernel32.func('uint32 GetLastError()')

    setAffinity = (hwndBuf, aff) => {
      const hwnd = hwndBuf.readUInt32LE(0)
      setLastErr(0)
      const result = setWDA(hwnd, aff)
      if (!result) {
        const err = getLastErr()
        console.warn(`[stealth] SetWindowDisplayAffinity(${aff}) failed: HWND=0x${hwnd.toString(16).toUpperCase()} err=${err}`)
      }
      return result !== 0
    }
    stealthMethod = 'koffi'
    return true
  } catch (e) {
    console.warn('[stealth] koffi load failed:', e.message)
    return false
  }
}

// ─── Method 2: ffi-napi (optional, requires VS Build Tools) ───────────────

function tryLoadFfiNapi() {
  if (setAffinity) return true
  if (!isWindows19041()) return false
  try {
    const ffi = require('ffi-napi')
    const user32 = ffi.Library('user32', {
      SetWindowDisplayAffinity: ['bool', ['uint32', 'uint32']]
    })
    setAffinity = (hwndBuf, aff) => user32.SetWindowDisplayAffinity(hwndBuf.readUInt32LE(0), aff)
    stealthMethod = 'ffi-napi'
    return true
  } catch {
    return false
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function isWindows19041() {
  if (process.platform !== 'win32') return false
  const build = parseInt(os.release().split('.')[2] || '0', 10)
  return build >= 19041
}

// ─── Public API ────────────────────────────────────────────────────────────

export function makeWindowStealth(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) return false

  browserWindow.setContentProtection(true)

  if (!isWindows19041()) return false

  if (!setAffinity) {
    tryLoadKoffi() || tryLoadFfiNapi()
  }

  if (setAffinity) {
    try {
      const hwndBuf = browserWindow.getNativeWindowHandle()
      const ok = setAffinity(hwndBuf, WDA_EXCLUDEFROMCAPTURE)
      if (ok) {
        const hwndHex = hwndBuf.readUInt32LE(0).toString(16).toUpperCase()
        console.log(`[stealth] WDA_EXCLUDEFROMCAPTURE set via ${stealthMethod} (HWND=0x${hwndHex})`)
        return true
      }
    } catch (err) {
      console.warn(`[stealth] ${stealthMethod} call threw:`, err.message)
    }
  }

  console.warn('[stealth] No in-process FFI available — relying on setContentProtection only')
  return false
}

export function removeWindowStealth(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) return
  browserWindow.setContentProtection(false)
  if (setAffinity) {
    try { setAffinity(browserWindow.getNativeWindowHandle(), WDA_NONE) } catch {}
  }
}
