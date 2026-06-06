import { useState, useEffect, useRef } from 'react'
import logoSvg from './assets/logo.svg'
import StatusBar from './components/StatusBar'
import AnswerPanel from './components/AnswerPanel'
import TranscriptPanel from './components/TranscriptPanel'
import ActionBar from './components/ActionBar'
import SettingsPanel from './components/SettingsPanel'
import HistoryPanel from './components/HistoryPanel'

const PANEL_MAIN = 'main'
const PANEL_SETTINGS = 'settings'
const PANEL_HISTORY = 'history'

const STATUSES = {
  idle: 'idle',
  recording: 'recording',
  transcribing: 'transcribing',
  analyzing: 'analyzing',
  responding: 'responding',
  error: 'error'
}

export default function App() {
  const [status, setStatus] = useState(STATUSES.idle)
  const [mode, setMode] = useState('general')
  const [answer, setAnswer] = useState('')
  const [streamingAnswer, setStreamingAnswer] = useState('')
  const [transcript, setTranscript] = useState('')
  const [panel, setPanel] = useState(PANEL_MAIN)
  const [settings, setSettings] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [fontSize, setFontSize] = useState(14)
  const [opacity, setOpacity] = useState(90)
  const [isStreaming, setIsStreaming] = useState(false)
  const [teleprompterActive, setTeleprompterActive] = useState(false)
  const [teleprompterSpeed, setTeleprompterSpeed] = useState(3) // 1–5

  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const streamingRef = useRef('')
  const stopRequestedRef = useRef(false)
  const ga = window.ghostassist

  // ─── Load settings ─────────────────────────────────────────────────────────
  useEffect(() => {
    ga.settings.getAll().then((s) => {
      setSettings(s)
      setMode(s.mode || 'general')
      setFontSize(parseInt(s.font_size || '14', 10))
      setOpacity(parseInt(s.opacity || '90', 10))
    })
  }, [])

  // ─── Pre-warm mic permission so first recording has no dialog delay ─────────
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((s) => s.getTracks().forEach((t) => t.stop()))
      .catch(() => {})
  }, [])

  // ─── IPC listeners ─────────────────────────────────────────────────────────
  useEffect(() => {
    const listeners = [
      ga.on('claude:token', ({ text }) => {
        streamingRef.current += text
        setStreamingAnswer(streamingRef.current)
        setIsStreaming(true)
      }),

      ga.on('claude:complete', ({ response }) => {
        setAnswer(response || streamingRef.current)
        setStreamingAnswer('')
        streamingRef.current = ''
        setIsStreaming(false)
        setStatus(STATUSES.idle)
      }),

      ga.on('transcript:ready', ({ text }) => {
        setTranscript(text)
      }),

      ga.on('status:transcribing', () => setStatus(STATUSES.transcribing)),
      ga.on('status:analyzing', () => setStatus(STATUSES.analyzing)),
      ga.on('status:responding', () => {
        setStatus(STATUSES.responding)
        setAnswer('')
        streamingRef.current = ''
        setStreamingAnswer('')
        setTeleprompterActive(false)
      }),

      ga.on('answer:clear', () => {
        setAnswer('')
        setStreamingAnswer('')
        streamingRef.current = ''
        setTranscript('')
        setStatus(STATUSES.idle)
      }),

      ga.on('error', ({ message }) => {
        setErrorMsg(message)
        setStatus(STATUSES.error)
        setTimeout(() => {
          setErrorMsg('')
          setStatus(STATUSES.idle)
        }, 5000)
      }),

      // Audio recording control from hotkeys
      ga.on('audio:start-recording', () => startMediaRecorder()),
      ga.on('audio:stop-recording', () => stopMediaRecorder()),

      ga.on('hotkey:listen:down', () => setStatus(STATUSES.recording)),
      ga.on('hotkey:listen:up', () => {
        // Show "Thinking…" immediately — don't wait for Whisper to finish
        setStatus(STATUSES.responding)
        setAnswer('')
        streamingRef.current = ''
        setStreamingAnswer('')
        setTeleprompterActive(false)
      }),

      ga.on('hotkey:screenshot:start', () => setStatus(STATUSES.analyzing)),
      ga.on('hotkey:screenshot:done', () => {}),
      ga.on('hotkey:screenshot:error', ({ error }) => {
        setErrorMsg(`Screenshot failed: ${error}`)
        setStatus(STATUSES.error)
      }),

      ga.on('hotkey:clear', () => {
        setAnswer('')
        setStreamingAnswer('')
        streamingRef.current = ''
        setTranscript('')
        setStatus(STATUSES.idle)
      }),

      ga.on('hotkey:settings', () => setPanel(PANEL_SETTINGS)),

      ga.on('hotkey:mode-change', ({ mode: newMode }) => {
        setMode(newMode)
      }),

      ga.on('hotkey:font-increase', () => setFontSize((f) => Math.min(f + 1, 24))),
      ga.on('hotkey:font-decrease', () => setFontSize((f) => Math.max(f - 1, 10))),
      ga.on('hotkey:opacity-increase', () => setOpacity((o) => Math.min(o + 5, 100))),
      ga.on('hotkey:opacity-decrease', () => setOpacity((o) => Math.max(o - 5, 20))),
      ga.on('hotkey:visibility-toggle', () => setOpacity((o) => o > 0 ? 0 : 90))
    ]

    return () => listeners.forEach((unsub) => unsub && unsub())
  }, [])

  // Save font size and opacity changes
  useEffect(() => {
    ga.settings.set('font_size', fontSize)
  }, [fontSize])

  useEffect(() => {
    ga.settings.set('opacity', opacity)
  }, [opacity])

  // ─── Audio recording via MediaRecorder ────────────────────────────────────
  async function startMediaRecorder() {
    stopRequestedRef.current = false
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        },
        video: false
      })

      // Stop was requested while getUserMedia was pending (quick tap / fast release)
      if (stopRequestedRef.current) {
        stream.getTracks().forEach((t) => t.stop())
        setStatus(STATUSES.idle)
        return
      }

      streamRef.current = stream
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      const chunks = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' })

          if (blob.size < 1000) {
            // Too short to be useful — abort silently
            setStatus(STATUSES.idle)
            stream.getTracks().forEach((t) => t.stop())
            streamRef.current = null
            return
          }

          const arrayBuffer = await blob.arrayBuffer()
          const bytes = new Uint8Array(arrayBuffer)
          // Chunked to avoid stack overflow and O(n²) string concat
          const CHUNK = 8192
          let binary = ''
          for (let i = 0; i < bytes.length; i += CHUNK) {
            binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
          }
          const base64 = btoa(binary)
          ga.audio.sendBlob(base64, 'audio/webm')
        } catch (err) {
          setErrorMsg(`Audio encoding failed: ${err.message}`)
          setStatus(STATUSES.error)
        } finally {
          stream.getTracks().forEach((t) => t.stop())
          streamRef.current = null
        }
      }

      recorder.start(100)
      mediaRecorderRef.current = recorder
    } catch (err) {
      setErrorMsg(`Microphone access denied: ${err.message}`)
      setStatus(STATUSES.error)
    }
  }

  function stopMediaRecorder() {
    stopRequestedRef.current = true
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      mediaRecorderRef.current = null
    }
  }

  // ─── Text query from overlay input ─────────────────────────────────────────
  async function handleTextQuery(text) {
    if (!text.trim()) return
    setStatus(STATUSES.responding)
    setAnswer('')
    streamingRef.current = ''
    setStreamingAnswer('')
    setTranscript(text)
    await ga.query.text(text)
  }

  // ─── Mode change ───────────────────────────────────────────────────────────
  async function handleModeChange(newMode) {
    setMode(newMode)
    await ga.settings.set('mode', newMode)
  }

  // ─── Opacity style ─────────────────────────────────────────────────────────
  const windowStyle = {
    opacity: opacity / 100,
    fontSize: `${fontSize}px`,
    pointerEvents: opacity === 0 ? 'none' : 'auto'  // don't block clicks when hidden
  }

  const currentAnswer = isStreaming ? streamingAnswer : answer

  return (
    <div
      className="ghost-window flex flex-col h-full overflow-hidden select-none"
      style={windowStyle}
    >
      <StatusBar
        status={status}
        mode={mode}
        onModeChange={handleModeChange}
        fontSize={fontSize}
        opacity={opacity}
        onOpacityChange={setOpacity}
        onFontSizeChange={setFontSize}
        onClose={() => ga.window.close()}
        onMinimize={() => ga.window.minimize()}
      />

      {panel === PANEL_MAIN && (
        <>
          {(currentAnswer || errorMsg) && (
            <AnswerPanel
              answer={currentAnswer}
              errorMsg={errorMsg}
              isStreaming={isStreaming}
              fontSize={fontSize}
              teleprompterActive={teleprompterActive}
              teleprompterSpeed={teleprompterSpeed}
              onTeleprompterEnd={() => setTeleprompterActive(false)}
            />
          )}

          {!currentAnswer && !errorMsg && (
            <IdlePlaceholder status={status} />
          )}

          {transcript && (
            <TranscriptPanel text={transcript} />
          )}

          <ActionBar
            status={status}
            hasAnswer={!!(currentAnswer && !isStreaming)}
            teleprompterActive={teleprompterActive}
            teleprompterSpeed={teleprompterSpeed}
            onTeleprompterToggle={() => setTeleprompterActive((a) => !a)}
            onTeleprompterSpeedChange={(delta) =>
              setTeleprompterSpeed((s) => Math.min(5, Math.max(1, s + delta)))
            }
            onClear={() => {
              setAnswer('')
              setStreamingAnswer('')
              streamingRef.current = ''
              setTranscript('')
              setTeleprompterActive(false)
              setStatus(STATUSES.idle)
            }}
            onCopyAnswer={() => navigator.clipboard.writeText(currentAnswer)}
            onOpenSettings={() => setPanel(PANEL_SETTINGS)}
            onOpenHistory={() => setPanel(PANEL_HISTORY)}
            onTextQuery={handleTextQuery}
          />
        </>
      )}

      {panel === PANEL_SETTINGS && (
        <SettingsPanel
          settings={settings}
          onClose={() => setPanel(PANEL_MAIN)}
          onSettingChange={async (key, value) => {
            await ga.settings.set(key, value)
            setSettings((prev) => ({ ...prev, [key]: value }))
          }}
          onFontSizeChange={setFontSize}
          onOpacityChange={setOpacity}
          fontSize={fontSize}
          opacity={opacity}
        />
      )}

      {panel === PANEL_HISTORY && (
        <HistoryPanel onClose={() => setPanel(PANEL_MAIN)} />
      )}
    </div>
  )
}

function IdlePlaceholder({ status }) {
  const messages = {
    idle: { text: 'Hold Alt+Z to record • Alt+S for screenshot', color: 'text-slate-600' },
    transcribing: { text: 'Transcribing audio...', color: 'text-blue-400' },
    analyzing: { text: 'Analysing screenshot...', color: 'text-blue-400' },
    responding: { text: 'Thinking...', color: 'text-blue-400' },
    recording: { text: 'Recording... release Alt+Z to send', color: 'text-red-400' }
  }

  const { text, color } = messages[status] || messages.idle

  return (
    <div className={`flex-1 min-h-0 flex flex-col items-center justify-center px-4 gap-3 ${color}`}>
      {status === 'idle' && (
        <img src={logoSvg} width="160" alt="GhostAssist AI" style={{ opacity: 0.18 }} />
      )}
      <p className="text-center text-xs">{text}</p>
    </div>
  )
}
