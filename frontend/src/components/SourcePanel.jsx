import React from 'react'
import { X, FileText, Hash, Bot } from 'lucide-react'
import './SourcePanel.css'

export default function SourcePanel({ sources, onClose }) {
  const scores = sources.map(s => s.relevance_score)
  const maxScore = Math.max(...scores)
  const minScore = Math.min(...scores)
  const range = maxScore - minScore || 1

  return (
    <aside className="source-panel">
      <div className="sp-header">
        <div className="sp-title">
          <Bot size={16} />
          <h3>Sources</h3>
          <span className="sp-count">{sources.length}</span>
        </div>
        <button className="sp-close" onClick={onClose}>
          <X size={16} />
        </button>
      </div>

      <div className="sp-list">
        {sources.map((src, i) => {
          const pct = sources.length === 1 ? 100 : Math.round(((src.relevance_score - minScore) / range) * 100)
          return (
            <div key={i} className="source-card">
              <div className="sc-header">
                <div className="sc-rank">
                  <Hash size={11} />
                  <span>{src.index}</span>
                </div>
                <div className="sc-file">
                  <FileText size={12} />
                  <span title={src.document}>{src.document}</span>
                </div>
                {src.page !== 'N/A' && (
                  <div className="sc-page">p.{src.page + 1}</div>
                )}
              </div>

              <div className="sc-score-row">
                <div className="sc-bar-bg">
                  <div className="sc-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span className="sc-score-val">{Math.round(pct)}%</span>
              </div>

              <p className="sc-snippet">{src.snippet}</p>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
