import React, { useState, useRef } from 'react'
import {
  Upload, FileText, Trash2, Settings, MessageSquarePlus,
  ChevronDown, ChevronUp, MessageCircle, HardDrive, Bot, X, Eraser,
  Sun, Moon
} from 'lucide-react'
import './Sidebar.css'

export default function Sidebar({
  documents, sessions, activeSession,
  onUpload, onDelete,
  onSelectSession, onDeleteSession, onNewChat, onClearAllSessions,
  uploading, theme, onToggleTheme
}) {
  const [dragOver, setDragOver] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [chunkSize, setChunkSize] = useState(500)
  const [chunkOverlap, setChunkOverlap] = useState(100)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState('')
  const [tab, setTab] = useState('documents')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const fileRef = useRef()

  async function handleFile(file) {
    if (!file) return
    setUploadError('')
    setUploadSuccess('')
    try {
      const res = await onUpload(file, chunkSize, chunkOverlap)
      setUploadSuccess(`"${file.name}" — ${res.document.chunks} chunks indexed`)
      setTimeout(() => setUploadSuccess(''), 5000)
    } catch (e) {
      setUploadError(e.message)
      setTimeout(() => setUploadError(''), 5000)
    }
  }

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  function formatSize(bytes) {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-brand-row">
        <div className="sidebar-brand" onClick={onNewChat} style={{ cursor: 'pointer' }}>
          <div className="brand-logo">
            <Bot size={20} />
          </div>
          <div className="brand-text">
            <span className="brand-name">RAG System</span>
            <span className="brand-tag">AI Document Intelligence</span>
          </div>
        </div>
        <button className="theme-toggle" onClick={onToggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* New Chat */}
      <div className="sidebar-section">
        <button className="new-chat-btn" onClick={onNewChat}>
          <MessageSquarePlus size={16} />
          <span>New Conversation</span>
        </button>
      </div>

      {/* Upload */}
      <div className="sidebar-section">
        <div
          className={`upload-zone ${dragOver ? 'drag-over' : ''} ${uploading ? 'uploading' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()}
        >
          <div className="upload-icon-wrap">
            <Upload size={18} />
          </div>
          <div className="upload-text">
            <span className="upload-title">{uploading ? 'Indexing document...' : 'Upload Document'}</span>
            <span className="upload-sub">PDF or TXT — drag & drop or click</span>
          </div>
          {uploading && <div className="upload-progress"><div className="upload-progress-bar" /></div>}
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.txt"
            hidden
            onChange={e => { handleFile(e.target.files[0]); e.target.value = '' }}
          />
        </div>
        {uploadError && (
          <div className="toast error">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError('')}><X size={12} /></button>
          </div>
        )}
        {uploadSuccess && (
          <div className="toast success">
            <span>{uploadSuccess}</span>
            <button onClick={() => setUploadSuccess('')}><X size={12} /></button>
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="sidebar-section">
        <button className="settings-toggle" onClick={() => setSettingsOpen(!settingsOpen)}>
          <Settings size={14} />
          <span>Processing Settings</span>
          {settingsOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
        {settingsOpen && (
          <div className="settings-panel">
            <div className="setting-row">
              <div className="setting-label">
                <span>Chunk Size</span>
                <span className="setting-value">{chunkSize}</span>
              </div>
              <input
                type="range" min="200" max="1500" step="100"
                value={chunkSize}
                onChange={e => setChunkSize(+e.target.value)}
              />
            </div>
            <div className="setting-row">
              <div className="setting-label">
                <span>Overlap</span>
                <span className="setting-value">{chunkOverlap}</span>
              </div>
              <input
                type="range" min="0" max="500" step="50"
                value={chunkOverlap}
                onChange={e => setChunkOverlap(+e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="sidebar-tabs">
        <button className={`tab ${tab === 'documents' ? 'active' : ''}`} onClick={() => setTab('documents')}>
          <HardDrive size={13} />
          <span>Docs</span>
          <span className="tab-count">{documents.length}</span>
        </button>
        <button className={`tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>
          <MessageCircle size={13} />
          <span>Chats</span>
          <span className="tab-count">{sessions.length}</span>
        </button>
      </div>

      {/* List */}
      <div className="sidebar-list">
        {tab === 'documents' && (
          <>
            {documents.length === 0 && (
              <div className="empty-list">
                <FileText size={20} />
                <span>No documents yet</span>
              </div>
            )}
            {documents.map(doc => (
              <div key={doc.id} className="list-item">
                <div className="item-icon doc-icon"><FileText size={14} /></div>
                <div className="item-info">
                  <span className="item-name" title={doc.name}>{doc.name}</span>
                  <span className="item-meta">
                    {doc.chunks} chunks · {doc.pages} pg{doc.file_size ? ` · ${formatSize(doc.file_size)}` : ''}
                  </span>
                </div>
                {confirmDelete === doc.id ? (
                  <div className="confirm-delete">
                    <button className="confirm-yes" onClick={() => { onDelete(doc.id); setConfirmDelete(null) }}>Yes</button>
                    <button className="confirm-no" onClick={() => setConfirmDelete(null)}>No</button>
                  </div>
                ) : (
                  <button className="item-delete" onClick={() => setConfirmDelete(doc.id)}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
        {tab === 'history' && (
          <>
            {sessions.length > 0 && (
              confirmDelete === 'all-sessions' ? (
                <div className="clear-confirm">
                  <span>Delete all chats?</span>
                  <button className="confirm-yes" onClick={() => { onClearAllSessions(); setConfirmDelete(null) }}>Yes</button>
                  <button className="confirm-no" onClick={() => setConfirmDelete(null)}>No</button>
                </div>
              ) : (
                <button className="clear-all-btn" onClick={() => setConfirmDelete('all-sessions')}>
                  <Eraser size={13} />
                  <span>Clear all history</span>
                </button>
              )
            )}
            {sessions.length === 0 && (
              <div className="empty-list">
                <MessageCircle size={20} />
                <span>No conversations yet</span>
              </div>
            )}
            {sessions.map(s => (
              <div
                key={s.id}
                className={`list-item clickable ${activeSession === s.id ? 'active' : ''}`}
                onClick={() => onSelectSession(s.id)}
              >
                <div className="item-icon chat-icon"><MessageCircle size={14} /></div>
                <div className="item-info">
                  <span className="item-name" title={s.title}>{s.title}</span>
                  <span className="item-meta">{s.message_count} messages</span>
                </div>
                {confirmDelete === s.id ? (
                  <div className="confirm-delete" onClick={e => e.stopPropagation()}>
                    <button className="confirm-yes" onClick={() => { onDeleteSession(s.id); setConfirmDelete(null) }}>Yes</button>
                    <button className="confirm-no" onClick={() => setConfirmDelete(null)}>No</button>
                  </div>
                ) : (
                  <button
                    className="item-delete"
                    onClick={e => { e.stopPropagation(); setConfirmDelete(s.id) }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}
