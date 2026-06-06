/**
 * Load environment variables from .env file.
 * Runs at import time — before app.whenReady() — so no Electron APIs used.
 * electron-vite injects __dirname for ESM main process files.
 */

import fs from 'fs'
import path from 'path'

function loadEnv() {
  const locations = [
    path.join(process.cwd(), '.env'),
    path.join(__dirname, '..', '..', '.env'),   // out/main/ → project root
    path.join(__dirname, '.env')                 // out/main/.env (packaged)
  ]

  for (const envPath of locations) {
    try {
      if (!fs.existsSync(envPath)) continue
      const content = fs.readFileSync(envPath, 'utf-8')
      for (const line of content.split('\n')) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue
        const eqIdx = trimmed.indexOf('=')
        if (eqIdx === -1) continue
        const key = trimmed.slice(0, eqIdx).trim()
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
        if (!process.env[key]) process.env[key] = value
      }
      console.log(`[env] Loaded from ${envPath}`)
      return
    } catch {}
  }

  console.warn('[env] No .env file found — ensure ANTHROPIC_API_KEY and OPENAI_API_KEY are set in environment')
}

loadEnv()
