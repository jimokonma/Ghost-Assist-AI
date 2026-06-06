import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const SPEED_MAP = [0, 20, 35, 55, 85, 130]

const KNOWN_SECTIONS = new Set([
  'definition', 'explanation', 'example', 'examples',
  'summary', 'note', 'overview', 'usage', 'syntax',
  'breakdown', 'steps', 'output', 'result'
])

function getChildText(children) {
  if (typeof children === 'string') return children
  if (Array.isArray(children)) return children.map(c => (typeof c === 'string' ? c : '')).join('')
  return ''
}

function HeadingNode({ children, depth }) {
  const plain = getChildText(children).toLowerCase().trim()
  if (KNOWN_SECTIONS.has(plain)) {
    return <div className={`section-label section-${plain}`}>{children}</div>
  }
  const Tag = `h${depth}`
  return <Tag className={`answer-heading depth-${depth}`}>{children}</Tag>
}

export default function AnswerPanel({
  answer,
  errorMsg,
  isStreaming,
  fontSize,
  teleprompterActive,
  teleprompterSpeed = 3,
  onTeleprompterEnd
}) {
  const panelRef = useRef(null)
  const rafRef = useRef(null)
  const scrollStartRef = useRef(null)

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (isStreaming && panelRef.current) {
      panelRef.current.scrollTop = panelRef.current.scrollHeight
    }
  }, [answer, isStreaming])

  // Teleprompter: constant-speed linear scroll from top to bottom
  useEffect(() => {
    if (!teleprompterActive || !panelRef.current) return

    const panel = panelRef.current
    panel.scrollTop = 0
    const totalScroll = panel.scrollHeight - panel.clientHeight

    if (totalScroll <= 0) {
      onTeleprompterEnd?.()
      return
    }

    scrollStartRef.current = null
    const pxPerSec = SPEED_MAP[teleprompterSpeed] ?? 55
    const duration = (totalScroll / pxPerSec) * 1000

    function tick(timestamp) {
      if (!scrollStartRef.current) scrollStartRef.current = timestamp
      const elapsed = timestamp - scrollStartRef.current
      const progress = Math.min(elapsed / duration, 1)
      panel.scrollTop = totalScroll * progress

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        onTeleprompterEnd?.()
      }
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [teleprompterActive])

  if (errorMsg) {
    return (
      <div className="flex-1 min-h-0 px-3 py-2 overflow-y-auto">
        <div className="bg-red-950 border border-red-800 rounded-md p-3 text-red-300 text-xs">
          <span className="font-semibold">Error: </span>{errorMsg}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className="flex-1 min-h-0 px-3 py-2 overflow-y-auto overflow-x-hidden answer-fade-in"
    >
      <div
        className={`answer-content ${isStreaming ? 'streaming-cursor' : ''}`}
        style={{ fontSize: `${fontSize}px`, width: '100%' }}
      >
        <ReactMarkdown
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '')
              if (!inline && match) {
                const codeText = String(children).replace(/\n$/, '')
                const lineCount = codeText.split('\n').length
                return (
                  <div className="code-block">
                    <div className="code-block-header">
                      <span className="code-block-lang">{match[1]}</span>
                      <span className="code-block-lines">
                        {lineCount} line{lineCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <SyntaxHighlighter
                      style={oneDark}
                      language={match[1]}
                      PreTag="div"
                      customStyle={{
                        margin: 0,
                        borderRadius: 0,
                        fontSize: 12,
                        background: '#0a1628',
                        padding: '12px 14px'
                      }}
                      {...props}
                    >
                      {codeText}
                    </SyntaxHighlighter>
                  </div>
                )
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              )
            },
            h1({ children }) { return <HeadingNode depth={1}>{children}</HeadingNode> },
            h2({ children }) { return <HeadingNode depth={2}>{children}</HeadingNode> },
            h3({ children }) { return <HeadingNode depth={3}>{children}</HeadingNode> },
            strong({ children }) {
              return <strong>{children}</strong>
            },
            p({ children }) { return <p>{children}</p> },
            ul({ children }) { return <ul>{children}</ul> },
            ol({ children }) { return <ol>{children}</ol> },
            li({ children }) { return <li>{children}</li> },
            blockquote({ children }) { return <blockquote>{children}</blockquote> }
          }}
        >
          {answer || ''}
        </ReactMarkdown>
      </div>
    </div>
  )
}
