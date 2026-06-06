import { useState } from 'react'

export default function TranscriptPanel({ text }) {
  const [collapsed, setCollapsed] = useState(false)

  if (!text) return null

  return (
    <div className="flex-shrink-0 border-t border-slate-800 px-3 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-500 font-medium">Question</span>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="text-xs text-slate-600 hover:text-slate-400 transition-colors"
        >
          {collapsed ? '▶' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <p className="text-xs text-slate-400 italic leading-relaxed line-clamp-3" title={text}>
          {text}
        </p>
      )}
    </div>
  )
}
