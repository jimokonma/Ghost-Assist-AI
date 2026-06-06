import { OpenAI, toFile } from 'openai'
import EventBus from './eventbus'
import * as database from './database'
import { getApiKey } from './apikeys'

let openaiClient = null

function getClient() {
  const key = getApiKey('openai')
  if (!key) throw new Error('OpenAI API key not configured. Open Settings → API Keys to add it.')
  if (openaiClient) return openaiClient
  openaiClient = new OpenAI({ apiKey: key })
  return openaiClient
}

export function resetClient() {
  openaiClient = null
}

async function transcribeAudio({ buffer, mimeType, durationMs }) {
  const model = database.getSetting('whisper_model') || 'whisper-1'
  const ext = mimeType && mimeType.includes('webm') ? 'webm' : 'wav'

  console.log(`[transcription] Transcribing ${(buffer.length / 1024).toFixed(1)} KB with ${model}`)

  try {
    const client = getClient()
    const uploadable = await toFile(buffer, `audio.${ext}`, {
      type: mimeType || 'audio/webm'
    })

    const transcription = await client.audio.transcriptions.create({
      model,
      file: uploadable,
      response_format: 'verbose_json',
      timestamp_granularities: ['word'],
      language: 'en',
      temperature: 0,
      prompt: 'This is a professional interview or business meeting. Technical terms, coding concepts, and business language may be used.'
    })

    const text = transcription.text?.trim() || ''
    console.log(`[transcription] Result: "${text.slice(0, 80)}..."`)

    EventBus.emit('transcript:ready', { text, raw: transcription })
    return text
  } catch (err) {
    console.error('[transcription] Whisper API error:', err.message)
    EventBus.emit('transcript:error', { error: err.message })
    throw err
  }
}

export { transcribeAudio }
