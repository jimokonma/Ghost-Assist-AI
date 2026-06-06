import { useState, useEffect } from 'react'

const MODE_COLORS = {
  general: 'text-slate-400',
  interview: 'text-purple-400',
  coding: 'text-green-400',
  meeting: 'text-blue-400',
  sales: 'text-orange-400'
}

export default function HistoryPanel({ onClose }) {
  const [sessions, setSessions] = useState([])
  const [selectedSession, setSelectedSession] = useState(null)
  const [exchanges, setExchanges] = useState([])
  const [loading, setLoading] = useState(true)
  const ga = window.ghostassist

  useEffect(() => {
    ga.history.getSessions().then((s) => {
      setSessions(s)
      setLoading(false)
    })
  }, [])

  async function loadExchanges(session) {
    setSelectedSession(session)
    const ex = await ga.history.getExchanges(session.id)
    setExchanges(ex)
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function formatDuration(seconds) {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return m > 0 ? `${m}m ${s}s` : `${s}s`
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          {selectedSession && (
            <button
              onClick={() => { setSelectedSession(null); setExchanges([]) }}
              className="ghost-btn"
            >
              ← Back
            </button>
          )}
          <h2 className="text-sm font-semibold text-slate-200">
            {selectedSession ? `Session #${selectedSession.id}` : 'Session History'}
          </h2>
        </div>
        <button onClick={onClose} className="ghost-btn">✕ Close</button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        {loading && (
          <p className="text-xs text-slate-600 text-center mt-4">Loading history...</p>
        )}

        {!loading && !selectedSession && (
          <>
            {sessions.length === 0 ? (
              <p className="text-xs text-slate-600 italic text-center mt-4">No sessions yet.</p>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => loadExchanges(session)}
                    className="w-full text-left bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg px-3 py-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold uppercase tracking-wide ${MODE_COLORS[session.mode] || 'text-slate-400'}`}>
                        {session.mode || 'general'}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(session.created_at)}</span>
                    </div>
                    <div className="flex gap-3 text-xs text-slate-500">
                      <span>{session.question_count || 0} questions</span>
                      <span>{formatDuration(session.duration_seconds)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selectedSession && (
          <div className="space-y-4">
            {exchanges.length === 0 ? (
              <p className="text-xs text-slate-600 italic text-center mt-4">No exchanges in this session.</p>
            ) : (
              exchanges.map((exchange) => (
                <ExchangeCard key={exchange.id} exchange={exchange} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ExchangeCard({ exchange }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full text-left px-3 py-2 hover:bg-slate-700 transition-colors"
      >
        <p className="text-xs text-slate-300 line-clamp-2 italic">
          {exchange.question_text || '[screenshot]'}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs text-slate-600">
            {exchange.response_time_ms ? `${exchange.response_time_ms}ms` : ''}
          </span>
          <span className="text-xs text-slate-600 ml-auto">
            {expanded ? '▲' : '▼'} {expanded ? 'Collapse' : 'Expand'}
          </span>
        </div>
      </button>

      {expanded && exchange.answer_text && (
        <div className="border-t border-slate-700 px-3 py-2">
          <p className="text-xs text-slate-400 whitespace-pre-wrap leading-relaxed">
            {exchange.answer_text.slice(0, 800)}
            {exchange.answer_text.length > 800 ? '...' : ''}
          </p>
          <button
            onClick={() => navigator.clipboard.writeText(exchange.answer_text)}
            className="mt-2 text-xs text-blue-500 hover:text-blue-400"
          >
            Copy answer
          </button>
        </div>
      )}
    </div>
  )
}
