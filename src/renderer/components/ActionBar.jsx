import { useState, useRef } from 'react'

const SPEED_LABELS = ['', '0.5×', '1×', '1.5×', '2×', '3×']

export default function ActionBar({
  status,
  hasAnswer,
  teleprompterActive,
  teleprompterSpeed,
  onTeleprompterToggle,
  onTeleprompterSpeedChange,
  onClear,
  onCopyAnswer,
  onOpenSettings,
  onOpenHistory,
  onTextQuery
}) {
  const [textInput, setTextInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef(null)

  const isProcessing = ['transcribing', 'analyzing', 'responding'].includes(status)

  function handleCopy() {
    onCopyAnswer()
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function handleToggleInput() {
    setShowInput((s) => !s)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!textInput.trim() || isProcessing) return
    const text = textInput.trim()
    setTextInput('')
    setShowInput(false)
    await onTextQuery(text)
  }

  return (
    <div className="flex-shrink-0 border-t border-slate-800 px-3 py-2">
      {showInput && (
        <form onSubmit={handleSubmit} className="mb-2">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type your question..."
              disabled={isProcessing}
              className="flex-1 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-600"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setShowInput(false); setTextInput('') }
              }}
            />
            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="px-2 py-1 bg-blue-700 hover:bg-blue-600 disabled:opacity-40 text-white text-xs rounded transition-colors"
            >
              Ask
            </button>
          </div>
        </form>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={handleToggleInput}
            className={`ghost-btn ${showInput ? 'text-blue-400' : ''}`}
            title="Type question"
          >
            ✏
          </button>

          {/* Teleprompter controls — only shown when there's an answer */}
          {hasAnswer && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onTeleprompterSpeedChange(-1)}
                disabled={teleprompterSpeed <= 1}
                className="ghost-btn px-1 disabled:opacity-30"
                title="Slower"
              >
                −
              </button>
              <button
                onClick={onTeleprompterToggle}
                className={`ghost-btn px-1.5 ${teleprompterActive ? 'text-green-400' : 'text-slate-400'}`}
                title={teleprompterActive ? 'Stop' : 'Play teleprompter'}
              >
                {teleprompterActive ? '■' : '▶'}
              </button>
              <span className="text-slate-500 text-xs w-6 text-center select-none">
                {SPEED_LABELS[teleprompterSpeed]}
              </span>
              <button
                onClick={() => onTeleprompterSpeedChange(1)}
                disabled={teleprompterSpeed >= 5}
                className="ghost-btn px-1 disabled:opacity-30"
                title="Faster"
              >
                +
              </button>
            </div>
          )}

          <button
            onClick={handleCopy}
            className="ghost-btn"
            title="Copy answer"
            disabled={isProcessing}
          >
            {copied ? '✓' : '⎘'}
          </button>
          <button
            onClick={onClear}
            className="ghost-btn"
            title="Clear (Alt+C)"
          >
            ⌫
          </button>
        </div>

        <div className="flex gap-1">
          <button
            onClick={onOpenHistory}
            className="ghost-btn"
            title="Session history"
          >
            ☰
          </button>
          <button
            onClick={onOpenSettings}
            className="ghost-btn"
            title="Settings (Alt+,)"
          >
            ⚙
          </button>
        </div>
      </div>
    </div>
  )
}
