/**
 * API key storage — keys are base64-encoded and stored in the local SQLite
 * settings table. safeStorage/DPAPI was removed because decryptString fails
 * silently in certain Windows contexts, making keys unreadable after save.
 *
 * Priority: database entry → process.env (dev .env file fallback)
 */

import * as database from './database'

const PREFIX = 'apikey_'

function encode(plaintext) {
  return Buffer.from(plaintext, 'utf-8').toString('base64')
}

function decode(stored) {
  if (!stored) return null
  try {
    // Handle legacy 'plain:' prefix from the old safeStorage fallback
    const raw = stored.startsWith('plain:') ? stored.slice(6) : stored
    const decoded = Buffer.from(raw, 'base64').toString('utf-8')
    return decoded || null
  } catch {
    return null
  }
}

/** Store an API key. name = 'anthropic' | 'openai' */
export function setApiKey(name, value) {
  database.setSetting(`${PREFIX}${name}`, encode(value.trim()))
  console.log(`[apikeys] ${name} key saved`)
}

/** Retrieve an API key. DB entry takes priority over .env so UI-saved keys win. */
export function getApiKey(name) {
  const stored = database.getSetting(`${PREFIX}${name}`)
  const decoded = decode(stored)
  if (decoded) return decoded

  return name === 'anthropic'
    ? process.env.ANTHROPIC_API_KEY
    : process.env.OPENAI_API_KEY
}

export function removeApiKey(name) {
  database.setSetting(`${PREFIX}${name}`, '')
}

export function hasApiKey(name) {
  return Boolean(getApiKey(name))
}

export function getStatus() {
  return {
    anthropic: hasApiKey('anthropic') ? 'set' : 'not_set',
    openai:    hasApiKey('openai')    ? 'set' : 'not_set'
  }
}
