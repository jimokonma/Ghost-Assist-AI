import { useState, useEffect } from 'react'

const TABS = ['API Keys', 'Appearance', 'Knowledge Base', 'Hotkeys', 'Data']

const HOTKEY_KEYS = [
  { key: 'hotkey_listen', label: 'Listen & Respond (hold)' },
  { key: 'hotkey_screenshot', label: 'Screenshot Analyse (hold)' },
  { key: 'hotkey_toggle', label: 'Toggle Visibility' },
  { key: 'hotkey_clear', label: 'Clear Answer' },
  { key: 'hotkey_settings', label: 'Open Settings' },
  { key: 'hotkey_mode', label: 'Cycle Mode' }
]

export default function SettingsPanel({
  settings,
  onClose,
  onSettingChange,
  fontSize,
  opacity,
  onFontSizeChange,
  onOpacityChange
}) {
  const [tab, setTab] = useState('API Keys')
  const [kbFiles, setKbFiles] = useState([])
  const [kbLoading, setKbLoading] = useState(false)
  const ga = window.ghostassist

  useEffect(() => {
    if (tab === 'Knowledge Base') loadKbFiles()
  }, [tab])

  async function loadKbFiles() {
    setKbLoading(true)
    const files = await ga.knowledgeBase.list()
    setKbFiles(files)
    setKbLoading(false)
  }

  async function handleUploadKb() {
    const result = await ga.knowledgeBase.openDialog()
    if (!result.canceled) {
      await loadKbFiles()
    }
  }

  async function handleDeleteKb(filename) {
    await ga.knowledgeBase.delete(filename)
    await loadKbFiles()
  }

  async function handleClearAllData() {
    if (confirm('Clear all sessions, history, and conversation context? Knowledge base will be preserved.')) {
      await ga.data.clearAll()
    }
  }

  if (!settings) return null

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <h2 className="text-sm font-semibold text-slate-200">Settings</h2>
        <button onClick={onClose} className="ghost-btn">✕ Close</button>
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 flex border-b border-slate-800 px-2 pt-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors mr-1 ${
              tab === t
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {tab === 'API Keys' && (
          <ApiKeysTab />
        )}

        {tab === 'Appearance' && (
          <AppearanceTab
            fontSize={fontSize}
            opacity={opacity}
            onFontSizeChange={(v) => { onFontSizeChange(v); onSettingChange('font_size', v) }}
            onOpacityChange={(v) => { onOpacityChange(v); onSettingChange('opacity', v) }}
          />
        )}

        {tab === 'Knowledge Base' && (
          <KnowledgeBaseTab
            files={kbFiles}
            loading={kbLoading}
            onUpload={handleUploadKb}
            onDelete={handleDeleteKb}
          />
        )}

        {tab === 'Hotkeys' && (
          <HotkeysTab settings={settings} onChange={onSettingChange} />
        )}

        {tab === 'Data' && (
          <DataTab onClearAll={handleClearAllData} />
        )}
      </div>
    </div>
  )
}

function AppearanceTab({ fontSize, opacity, onFontSizeChange, onOpacityChange }) {
  return (
    <div className="space-y-5">
      <SettingRow label="Font Size" value={`${fontSize}px`}>
        <input
          type="range" min="10" max="24" step="1" value={fontSize}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </SettingRow>

      <SettingRow label="Window Opacity" value={`${opacity}%`}>
        <input
          type="range" min="20" max="100" step="5" value={opacity}
          onChange={(e) => onOpacityChange(Number(e.target.value))}
          className="w-full accent-blue-500"
        />
      </SettingRow>

      <div className="text-xs text-slate-500 mt-3 space-y-1">
        <p>• Use <kbd className="kbd">Alt+[</kbd> / <kbd className="kbd">Alt+]</kbd> to adjust opacity live</p>
        <p>• Use <kbd className="kbd">Alt+−</kbd> / <kbd className="kbd">Alt+=</kbd> to adjust font size live</p>
        <p>• Drag the top bar to reposition the overlay</p>
      </div>
    </div>
  )
}

function KnowledgeBaseTab({ files, loading, onUpload, onDelete }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">
          Upload your CV, resume, or notes. Claude will use them to personalise answers.
        </p>
        <button
          onClick={onUpload}
          className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded transition-colors whitespace-nowrap ml-3"
        >
          + Upload
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-600">Loading...</p>
      ) : files.length === 0 ? (
        <p className="text-xs text-slate-600 italic">No documents uploaded yet.</p>
      ) : (
        <div className="space-y-2">
          {files.map(({ filename }) => (
            <div key={filename} className="flex items-center justify-between bg-slate-800 rounded px-3 py-2">
              <span className="text-xs text-slate-300 truncate">{filename}</span>
              <button
                onClick={() => onDelete(filename)}
                className="text-xs text-red-500 hover:text-red-400 ml-2 shrink-0"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HotkeysTab({ settings, onChange }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        Hotkeys are registered at OS level and cannot be detected by meeting apps.
        Edit and press Enter to save.
      </p>
      {HOTKEY_KEYS.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between gap-3">
          <label className="text-xs text-slate-400 flex-1">{label}</label>
          <input
            type="text"
            defaultValue={settings[key] || ''}
            onBlur={(e) => onChange(key, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur() }}
            className="w-28 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-blue-300 text-center focus:outline-none focus:border-blue-600"
          />
        </div>
      ))}
    </div>
  )
}

function DataTab({ onClearAll }) {
  return (
    <div className="space-y-4">
      <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-400 space-y-2">
        <p className="font-semibold text-slate-300">Data Privacy</p>
        <p>• All data stored locally — no telemetry, no cloud sync</p>
        <p>• Only data leaving this device: audio → Whisper API, text/image → Claude API</p>
        <p>• SQLite database: <code className="text-green-400">%APPDATA%\GhostAssistAI\data.db</code></p>
      </div>

      <div>
        <button
          onClick={onClearAll}
          className="w-full px-3 py-2 bg-red-900 hover:bg-red-800 border border-red-700 text-red-300 text-xs rounded transition-colors"
        >
          Clear All Session Data
        </button>
        <p className="text-xs text-slate-600 mt-1 text-center">
          Removes all sessions and conversation history. Knowledge base preserved.
        </p>
      </div>
    </div>
  )
}

function ApiKeysTab() {
  const ga = window.ghostassist
  const [status, setStatus] = useState({ anthropic: 'not_set', openai: 'not_set' })
  const [anthropicVal, setAnthropicVal] = useState('')
  const [openaiVal, setOpenaiVal] = useState('')
  const [saving, setSaving] = useState('')
  const [msg, setMsg] = useState(null) // { text, ok }

  useEffect(() => {
    ga.apiKeys.status().then(setStatus)
  }, [])

  function flash(text, ok) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }

  async function save(name, value, clearFn) {
    if (!value.trim()) return
    setSaving(name)
    try {
      const res = await ga.apiKeys.set(name, value.trim())
      setSaving('')
      if (res && res.success) {
        clearFn('')
        const s = await ga.apiKeys.status()
        setStatus(s)
        flash(`${name === 'anthropic' ? 'Anthropic' : 'OpenAI'} key saved`, true)
      } else {
        flash((res && res.error) || 'Failed to save', false)
      }
    } catch (err) {
      setSaving('')
      flash(err.message || 'Unexpected error saving key', false)
    }
  }

  async function remove(name) {
    const res = await ga.apiKeys.remove(name)
    if (res.success) {
      setStatus(await ga.apiKeys.status())
      flash(`${name === 'anthropic' ? 'Anthropic' : 'OpenAI'} key removed`, true)
    }
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-slate-400">
        Keys are stored locally on this device only. They are never transmitted anywhere except to the Anthropic and OpenAI APIs.
      </p>

      {msg && (
        <div className={`text-xs px-3 py-2 rounded ${msg.ok ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
          {msg.text}
        </div>
      )}

      {/* Anthropic */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">Anthropic API Key</label>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            status.anthropic === 'set'
              ? 'bg-green-900 text-green-400'
              : 'bg-red-950 text-red-400'
          }`}>
            {status.anthropic === 'set' ? '✓ Configured' : '⚠ Not set'}
          </span>
        </div>
        <input
          type="password"
          placeholder="sk-ant-…"
          value={anthropicVal}
          onChange={(e) => setAnthropicVal(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-600"
        />
        <div className="flex gap-2">
          <button
            onClick={() => save('anthropic', anthropicVal, setAnthropicVal)}
            disabled={!anthropicVal.trim() || saving === 'anthropic'}
            className="flex-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs rounded transition-colors"
          >
            {saving === 'anthropic' ? 'Saving…' : 'Save Key'}
          </button>
          {status.anthropic === 'set' && (
            <button
              onClick={() => remove('anthropic')}
              className="px-3 py-1.5 bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-400 text-xs rounded transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* OpenAI */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300">OpenAI API Key (Whisper)</label>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            status.openai === 'set'
              ? 'bg-green-900 text-green-400'
              : 'bg-red-950 text-red-400'
          }`}>
            {status.openai === 'set' ? '✓ Configured' : '⚠ Not set'}
          </span>
        </div>
        <input
          type="password"
          placeholder="sk-…"
          value={openaiVal}
          onChange={(e) => setOpenaiVal(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-600"
        />
        <div className="flex gap-2">
          <button
            onClick={() => save('openai', openaiVal, setOpenaiVal)}
            disabled={!openaiVal.trim() || saving === 'openai'}
            className="flex-1 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs rounded transition-colors"
          >
            {saving === 'openai' ? 'Saving…' : 'Save Key'}
          </button>
          {status.openai === 'set' && (
            <button
              onClick={() => remove('openai')}
              className="px-3 py-1.5 bg-slate-700 hover:bg-red-900 text-slate-400 hover:text-red-400 text-xs rounded transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-800">
        <p>• Anthropic key: <span className="text-slate-500">console.anthropic.com</span></p>
        <p>• OpenAI key: <span className="text-slate-500">platform.openai.com/api-keys</span></p>
      </div>
    </div>
  )
}

function SettingRow({ label, value, children }) {
  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <label className="text-xs text-slate-400">{label}</label>
        <span className="text-xs text-blue-400 font-mono">{value}</span>
      </div>
      {children}
    </div>
  )
}
