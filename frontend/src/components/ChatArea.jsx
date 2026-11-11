import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  Send, FileText, Clock, Layers,
  Search, Brain, ArrowRight, Bot, Upload,
  Copy, Check, ArrowDown, Database
} from 'lucide-react'
import './ChatArea.css'

const SUGGESTIONS = [
  'What are the key topics covered in this document?',
  'Summarize the main findings',
  'What conclusions are drawn?',
]

function renderMarkdown(text) {
  if (!text) return text
  const lines = text.split('\n')
  const elements = []

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i]

    if (/^#{1,3}\s/.test(line)) {
      const level = line.match(/^(#+)/)[1].length
      const content = line.replace(/^#+\s*/, '')
      elements.push(
        <div key={i} className={`md-h${level}`}>{formatInline(content)}</div>
      )
    } else if (/^\s*[-*]\s/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, '')
      elements.push(
        <div key={i} className="md-li">{formatInline(content)}</div>
      )
    } else if (/^\s*\d+\.\s/.test(line)) {
      const num = line.match(/^\s*(\d+)\./)[1]
      const content = line.replace(/^\s*\d+\.\s+/, '')
      elements.push(
        <div key={i} className="md-li md-ol"><span className="md-num">{num}.</span>{formatInline(content)}</div>
      )
    } else if (line.trim() === '') {
      elements.push(<div key={i} className="md-break" />)
    } else {
      elements.push(<div key={i} className="md-p">{formatInline(line)}</div>)
    }
  }
  return elements
}

function formatInline(text) {
  const parts = []
  const regex = /(\*\*(.+?)\*\*)|(\*([^*]+?)\*)|(`(.+?)`)/g
  let last = 0
  let match
  let key = 0

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index))
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>)
    } else if (match[4]) {
      parts.push(<em key={key++}>{match[4]}</em>)
    } else if (match[6]) {
      parts.push(<code key={key++} className="md-code">{match[6]}</code>)
    }
    last = regex.lastIndex
  }
  if (last < text.length) {
    parts.push(text.slice(last))
  }
  return parts
}

function formatTime(id) {
  const d = new Date(typeof id === 'number' ? id : Date.now())
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button className={`copy-btn ${copied ? 'copied' : ''}`} onClick={handleCopy} title="Copy to clipboard">
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

function Particles() {
  return (
    <div className="particles">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="particle"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            width: `${2 + Math.random() * 4}px`,
            height: `${2 + Math.random() * 4}px`,
            animationDelay: `${Math.random() * 6}s`,
            animationDuration: `${4 + Math.random() * 6}s`,
          }}
        />
      ))}
    </div>
  )
}

function OrbitRings() {
  return (
    <div className="orbit-container">
      <div className="orbit orbit-1" />
      <div className="orbit orbit-2" />
      <div className="orbit orbit-3" />
    </div>
  )
}

export default function ChatArea({
  messages, loading, onSend, onViewSources, hasDocuments,
  onUploadClick, mainUploadRef, onUploadFile, uploading, documentCount
}) {
  const [input, setInput] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const endRef = useRef()
  const inputRef = useRef()
  const chatRef = useRef()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (hasDocuments && !loading && inputRef.current) {
      inputRef.current.focus()
    }
  }, [hasDocuments, loading, messages])

  const handleScroll = useCallback(() => {
    if (!chatRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = chatRef.current
    setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 200)
  }, [])

  function scrollToBottom() {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  function handleSubmit(e) {
    e.preventDefault()
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    onSend(q)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSubmit(e)
    }
  }

  async function handleMainUpload(file) {
    if (!file) return
    setUploadError('')
    setUploadSuccess('')
    try {
      const res = await onUploadFile(file)
      setUploadSuccess(`"${file.name}" indexed — ${res.document.chunks} chunks ready to query`)
      setTimeout(() => setUploadSuccess(''), 5000)
    } catch (e) {
      setUploadError(e.message)
      setTimeout(() => setUploadError(''), 5000)
    }
  }

  return (
    <main className="chat-area">
      {/* Knowledge base bar */}
      {hasDocuments && messages.length > 0 && (
        <div className="kb-bar">
          <Database size={12} />
          <span>Searching across <strong>{documentCount}</strong> document{documentCount !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="chat-messages" ref={chatRef} onScroll={handleScroll}>
        {messages.length === 0 && (
          <div className="empty-state">
            <Particles />
            <div className="empty-glow" />

            <div className="hero-icon-wrap">
              <OrbitRings />
              <div className="hero-icon">
                <Brain size={30} strokeWidth={1.5} />
              </div>
            </div>

            <h1 className="empty-title">
              <span className="title-line">Ask your documents</span>
              <span className="gradient-text">anything</span>
            </h1>
            <p className="empty-desc">
              Upload documents and get AI-powered answers with source citations.
              Built with semantic search, cross-encoder reranking, and LLM generation.
            </p>

            <div className="pipeline-visual">
              <div className="pipeline-step step-anim-1">
                <div className="step-icon"><Search size={16} /></div>
                <span>Retrieve</span>
              </div>
              <ArrowRight size={14} className="pipeline-arrow arrow-anim-1" />
              <div className="pipeline-step step-anim-2">
                <div className="step-icon"><Layers size={16} /></div>
                <span>Rerank</span>
              </div>
              <ArrowRight size={14} className="pipeline-arrow arrow-anim-2" />
              <div className="pipeline-step step-anim-3">
                <div className="step-icon"><Bot size={16} /></div>
                <span>Generate</span>
              </div>
            </div>

            {hasDocuments && (
              <div className="suggestions">
                <span className="suggestions-label">Try asking:</span>
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    className="suggestion-chip"
                    style={{ animationDelay: `${0.6 + i * 0.1}s` }}
                    onClick={() => onSend(s)}
                  >
                    <Bot size={12} />
                    {s}
                  </button>
                ))}
              </div>
            )}

            {!hasDocuments && (
              <>
                <button
                  className="upload-cta"
                  onClick={onUploadClick}
                  disabled={uploading}
                >
                  <Upload size={18} />
                  <span>{uploading ? 'Processing document...' : 'Upload a document to get started'}</span>
                </button>
                <input
                  ref={mainUploadRef}
                  type="file"
                  accept=".pdf,.txt"
                  hidden
                  onChange={e => { handleMainUpload(e.target.files[0]); e.target.value = '' }}
                />
                {uploadError && <div className="cta-toast error">{uploadError}</div>}
                {uploadSuccess && <div className="cta-toast success">{uploadSuccess}</div>}
              </>
            )}
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`message ${msg.role} ${msg.error ? 'error' : ''}`}>
            {msg.role === 'assistant' && (
              <div className="msg-avatar ai-avatar">
                <Bot size={14} />
              </div>
            )}
            <div className="msg-body">
              <div className="msg-bubble">
                <div className="msg-content">
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                </div>
                {msg.role === 'assistant' && !msg.error && (
                  <div className="bubble-actions">
                    <CopyButton text={msg.content} />
                    <span className="msg-time">{formatTime(msg.id)}</span>
                  </div>
                )}
                {msg.role === 'user' && (
                  <span className="msg-time user-time">{formatTime(msg.id)}</span>
                )}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="msg-extras">
                  <button className="sources-btn" onClick={() => onViewSources(msg.sources)}>
                    <FileText size={13} />
                    <span>{msg.sources.length} sources referenced</span>
                    <ArrowRight size={12} />
                  </button>
                  {msg.metrics && (
                    <div className="metrics">
                      <div className="metric">
                        <Clock size={11} />
                        <span>{msg.metrics.latency_seconds}s</span>
                      </div>
                      <div className="metric">
                        <Search size={11} />
                        <span>{msg.metrics.documents_retrieved} retrieved</span>
                      </div>
                      <div className="metric">
                        <Layers size={11} />
                        <span>{msg.metrics.documents_after_rerank} reranked</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="msg-avatar user-avatar">You</div>
            )}
          </div>
        ))}

        {loading && (
          <div className="message assistant">
            <div className="msg-avatar ai-avatar thinking-avatar">
              <Brain size={14} />
            </div>
            <div className="msg-body">
              <div className="msg-bubble loading-bubble">
                <div className="thinking-animation">
                  <div className="brain-pulse">
                    <Brain size={20} />
                  </div>
                  <div className="thinking-content">
                    <span className="thinking-label">Generating answer</span>
                    <div className="thinking-bar">
                      <div className="thinking-bar-fill" />
                    </div>
                    <span className="thinking-steps">Retrieving → Reranking → Generating...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button className="scroll-bottom-btn" onClick={scrollToBottom}>
          <ArrowDown size={16} />
        </button>
      )}

      <div className="chat-input-wrap">
        <form className="chat-form" onSubmit={handleSubmit}>
          <div className="input-box">
            <input
              ref={inputRef}
              type="text"
              placeholder={hasDocuments ? 'Ask a question about your documents...' : 'Upload a document first...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !hasDocuments}
            />
            <div className="input-hint-inline">
              {input.trim() && <span>Enter ↵</span>}
            </div>
            <button type="submit" className="send-btn" disabled={!input.trim() || loading || !hasDocuments}>
              <Send size={16} />
            </button>
          </div>
        </form>
        <p className="input-hint">
          Powered by semantic search + cross-encoder reranking + Groq LLM
        </p>
      </div>
    </main>
  )
}
