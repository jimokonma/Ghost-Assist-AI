import Anthropic from '@anthropic-ai/sdk'
import EventBus from './eventbus'
import * as database from './database'
import { getApiKey } from './apikeys'

let anthropicClient = null
let conversationHistory = []

const SYSTEM_PROMPTS = {
  interview: `You are an elite interview coach assisting in a live interview.
FORMATTING RULES — follow exactly:
- No markdown headers (no #, ##, ###)
- No horizontal rules (no ---)
- No markdown tables
- Use plain short paragraphs or simple bullet points (- item)
- Bold only the most critical phrase per answer using **word**
- Keep under 200 words
For behavioural questions use STAR structure as plain prose: state the Situation briefly, the Task, your Action, and the Result. Reference the user's resume context if provided. Be direct and confident.`,

  coding: `You are a coding interview assistant.
FORMATTING RULES — follow exactly:
- No markdown headers (no #, ##), no horizontal rules (no ---)
- No markdown tables — write complexity as plain text e.g. "Time: O(n) · Space: O(n)"
- Use a single fenced code block for the solution
- Outside the code block use plain numbered steps only
Structure every answer as:
1. Problem — one sentence restatement
2. Approach — 2-3 sentences on the optimal strategy
3. Code — clean working solution in a fenced code block
4. Complexity — one line of plain text`,

  meeting: `You are a sharp meeting assistant.
FORMATTING RULES — follow exactly:
- No markdown headers, no horizontal rules, no tables
- Plain short sentences or simple bullet points (- item)
- Bold action items using **action**
- Under 150 words
Answer confidently and directly. Lead with the answer, then any key action items.`,

  sales: `You are a seasoned sales assistant.
FORMATTING RULES — follow exactly:
- No markdown headers, no horizontal rules, no tables
- Plain prose or simple bullet points (- item)
- Under 150 words
Handle objections with empathy then confidence. State the value clearly. End with one concrete next step.`,

  general: `You are a knowledgeable assistant responding in real time.
FORMATTING RULES — follow exactly:
- No markdown headers (no #, ##, ###)
- No horizontal rules (no ---)
- No markdown tables
- Use plain prose, simple bullet points (- item), or numbered steps
- Use fenced code blocks only for actual code
- Bold only key terms using **word**
- Under 250 words
Answer clearly and concisely. Structure for quick scanning without markdown clutter.`
}

function getClient() {
  const key = getApiKey('anthropic')
  if (!key) throw new Error('Anthropic API key not configured. Open Settings → API Keys to add it.')
  if (anthropicClient) return anthropicClient
  anthropicClient = new Anthropic({ apiKey: key })
  return anthropicClient
}

export function resetClient() {
  anthropicClient = null
}

function buildSystemPrompt(mode, knowledgeBase) {
  const base = SYSTEM_PROMPTS[mode] || SYSTEM_PROMPTS.general
  const kbSection = knowledgeBase
    ? `\n\n## USER PROFILE & KNOWLEDGE BASE\nThe following is personal information about the user. Use this to answer ANY personal questions (who are you, tell me about yourself, your experience, your skills, etc.):\n\n${knowledgeBase.slice(0, 8000)}`
    : ''

  return `${base}${kbSection}

RULES:
- If asked "who are you", "tell me about yourself", "your background" — answer using the knowledge base above
- Never say you don't have information if it exists in the knowledge base
- Keep answers concise, scannable, and jargon-free
- Max 250 words per response`
}

function addToHistory(role, content) {
  conversationHistory.push({ role, content })
  const maxExchanges = parseInt(database.getSetting('context_exchanges') || '3', 10)
  if (conversationHistory.length > maxExchanges * 2) {
    conversationHistory = conversationHistory.slice(-maxExchanges * 2)
  }
}

function clearHistory() {
  conversationHistory = []
}

async function getResponse({ question, mode = 'general', screenshot = null, sessionId = null }) {
  const client = getClient()
  const knowledgeBase = database.getKnowledgeBase()
  const systemPrompt = buildSystemPrompt(mode, knowledgeBase)
  const startTime = Date.now()

  const userMessage = buildUserMessage(question, screenshot)
  const messages = [...conversationHistory, { role: 'user', content: userMessage }]

  console.log(`[claude] Streaming response (mode: ${mode}, screenshot: ${!!screenshot})`)

  EventBus.emit('claude:start', { mode })

  let fullResponse = ''

  try {
    const stream = client.messages.stream({
      model: database.getSetting('claude_model') || 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: systemPrompt,
      messages
    })

    stream.on('text', (text) => {
      fullResponse += text
      EventBus.emit('claude:token', { text })
    })

    await stream.finalMessage()

    const responseTimeMs = Date.now() - startTime
    console.log(`[claude] Complete in ${responseTimeMs}ms (${fullResponse.length} chars)`)

    addToHistory('user', userMessage)
    addToHistory('assistant', fullResponse)

    if (sessionId) {
      database.saveExchange({
        sessionId,
        questionText: question || '[screenshot]',
        answerText: fullResponse,
        responseTimeMs
      })
    }

    EventBus.emit('claude:complete', { response: fullResponse, responseTimeMs })
    return { response: fullResponse, responseTimeMs }
  } catch (err) {
    console.error('[claude] API error:', err.message)
    EventBus.emit('claude:error', { error: err.message })
    throw err
  }
}

function buildUserMessage(question, screenshot) {
  if (screenshot) {
    return [
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
      { type: 'text', text: question || 'Analyse this coding problem and provide a complete solution with time and space complexity.' }
    ]
  }
  return question || ''
}

export { getResponse, clearHistory, addToHistory }
