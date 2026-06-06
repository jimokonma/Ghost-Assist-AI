import { useState } from 'react'

const MODES = ['general', 'interview', 'coding', 'meeting', 'sales']

const MODE_LABELS = {
  general: 'General',
  interview: 'Interview',
  coding: 'Coding',
  meeting: 'Meeting',
  sales: 'Sales'
}

export default function StatusBar({
  status,
  mode,
  onModeChange,
  fontSize,
  opacity,
  onOpacityChange,
  onFontSizeChange,
  onClose,
  onMinimize
}) {
  const isRecording = status === 'recording'

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-slate-800 cursor-move bg-slate-900 rounded-t-lg"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Left: Logo + recording indicator */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
        <svg width="22" height="22" viewBox="222 52 236 236" xmlns="http://www.w3.org/2000/svg" aria-label="GhostAssist AI">
          <circle cx="340" cy="170" r="118" fill="none" stroke="rgba(255,215,0,0.133)" strokeWidth="12"/>
          <path d="M340 62 L420 92 L420 172 Q420 222 340 252 Q260 222 260 172 L260 92 Z" fill="#0f172a"/>
          <path d="M340 62 L420 92 L420 172 Q420 222 340 252 Q260 222 260 172 L260 92 Z" fill="none" stroke="#FFD700" strokeWidth="2.5"/>
          <line x1="268" y1="120" x2="412" y2="120" stroke="rgba(255,215,0,0.267)" strokeWidth="1"/>
          <line x1="268" y1="135" x2="412" y2="135" stroke="rgba(255,215,0,0.267)" strokeWidth="1"/>
          <line x1="268" y1="150" x2="412" y2="150" stroke="rgba(255,215,0,0.267)" strokeWidth="1"/>
          <line x1="268" y1="165" x2="412" y2="165" stroke="rgba(255,215,0,0.267)" strokeWidth="1"/>
          <line x1="268" y1="180" x2="412" y2="180" stroke="rgba(255,215,0,0.267)" strokeWidth="1"/>
          <line x1="268" y1="195" x2="412" y2="195" stroke="rgba(255,215,0,0.267)" strokeWidth="1"/>
          <path d="M310 104 Q310 88 325 84 L355 84 Q370 88 370 104 L370 175 L362 168 L354 175 L346 168 L338 175 L330 168 L322 175 L314 168 L310 175 Z" fill="#1e293b"/>
          <path d="M310 104 Q310 88 325 84 L355 84 Q370 88 370 104 L370 175 L362 168 L354 175 L346 168 L338 175 L330 168 L322 175 L314 168 L310 175 Z" fill="none" stroke="#FFD700" strokeWidth="2"/>
          <ellipse cx="328" cy="122" rx="8" ry="9" fill="#FFD700"/>
          <ellipse cx="352" cy="122" rx="8" ry="9" fill="#FFD700"/>
          <ellipse cx="329" cy="123" rx="4" ry="5" fill="#0f172a"/>
          <ellipse cx="353" cy="123" rx="4" ry="5" fill="#0f172a"/>
          <circle cx="331" cy="120" r="1.5" fill="#FFD700"/>
          <circle cx="355" cy="120" r="1.5" fill="#FFD700"/>
          <circle cx="260" cy="92" r="3" fill="#FFD700"/>
          <circle cx="420" cy="92" r="3" fill="#FFD700"/>
          <circle cx="340" cy="252" r="3" fill="#FFD700"/>
        </svg>
        {isRecording && (
          <span className="recording-dot w-2 h-2 bg-red-500 rounded-full" />
        )}
      </div>

      {/* Center: Mode selector */}
      <div style={{ WebkitAppRegion: 'no-drag' }}>
        <ModeSelector mode={mode} onChange={onModeChange} />
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
        <button
          onClick={() => onFontSizeChange((f) => Math.max(f - 1, 10))}
          className="ghost-btn text-xs w-5 h-5 flex items-center justify-center"
          title="Decrease font"
        >
          A
        </button>
        <button
          onClick={() => onFontSizeChange((f) => Math.min(f + 1, 24))}
          className="ghost-btn text-sm w-5 h-5 flex items-center justify-center"
          title="Increase font"
        >
          A
        </button>
        <OpacitySlider value={opacity} onChange={onOpacityChange} />
        <button
          onClick={onMinimize}
          className="ghost-btn w-5 h-5 flex items-center justify-center"
          title="Hide to tray"
        >
          –
        </button>
        <button
          onClick={onClose}
          className="ghost-btn text-red-400 hover:text-red-300 hover:bg-red-900 w-5 h-5 flex items-center justify-center"
          title="Close"
        >
          ×
        </button>
      </div>
    </div>
  )
}

function ModeSelector({ mode, onChange }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`mode-badge mode-${mode} cursor-pointer hover:opacity-80 transition-opacity`}
      >
        {MODE_LABELS[mode] || mode}
      </button>

      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 min-w-[110px]">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => { onChange(m); setOpen(false) }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                m === mode ? 'font-bold' : 'text-white hover:bg-slate-700'
              }`}
              style={m === mode ? { background: '#FFD700', color: '#000000' } : {}}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function OpacitySlider({ value, onChange }) {
  return (
    <input
      type="range"
      min="20"
      max="100"
      step="5"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-14 h-1 accent-blue-500 cursor-pointer"
      title={`Opacity: ${value}%`}
    />
  )
}
