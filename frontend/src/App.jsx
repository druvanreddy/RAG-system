import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import SourcePanel from './components/SourcePanel'
import './App.css'

const api = axios.create({ baseURL: '/api' })

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

export default function App() {
  const [documents, setDocuments] = useState([])
  const [sessions, setSessions] = useState([])
  const [activeSession, setActiveSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [activeSources, setActiveSources] = useState(null)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('rag-theme') || 'dark' } catch { return 'dark' }
  })
  const mainUploadRef = useRef()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('rag-theme', theme) } catch {}
  }, [theme])

  function toggleTheme() {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }

  useEffect(() => {
    fetchDocuments()
    fetchSessions()
  }, [])

  async function fetchDocuments() {
    try {
      const res = await api.get('/documents')
      setDocuments(res.data.documents)
    } catch (e) {
      console.error('Failed to fetch documents', e)
    }
  }

  async function fetchSessions() {
    try {
      const res = await api.get('/sessions')
      setSessions(res.data.sessions)
    } catch (e) {
      console.error('Failed to fetch sessions', e)
    }
  }

  async function handleSelectSession(sessionId) {
    try {
      const res = await api.get(`/sessions/${sessionId}`)
      setActiveSession(sessionId)
      setMessages(res.data.messages.map((m, i) => ({
        id: i,
        role: m.role,
        content: m.content,
      })))
      setActiveSources(null)
      setSourceOpen(false)
    } catch (e) {
      console.error('Failed to load session', e)
    }
  }

  async function handleDeleteSession(sessionId) {
    try {
      await api.delete(`/sessions/${sessionId}`)
      if (activeSession === sessionId) {
        handleNewChat()
      }
      await fetchSessions()
    } catch (e) {
      console.error('Failed to delete session', e)
    }
  }

  async function handleClearAllSessions() {
    try {
      await api.delete('/sessions')
      handleNewChat()
      await fetchSessions()
    } catch (e) {
      console.error('Failed to clear sessions', e)
    }
  }

  function handleNewChat() {
    setActiveSession(null)
    setMessages([])
    setActiveSources(null)
    setSourceOpen(false)
  }

  async function handleUpload(file, chunkSize, chunkOverlap) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await api.post(
        `/documents/upload?chunk_size=${chunkSize}&chunk_overlap=${chunkOverlap}`,
        form
      )
      await fetchDocuments()
      return res.data
    } catch (e) {
      const msg = e.response?.data?.detail || 'Upload failed'
      throw new Error(msg)
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(docId) {
    try {
      await api.delete(`/documents/${docId}`)
      await fetchDocuments()
    } catch (e) {
      console.error('Failed to delete', e)
    }
  }

  async function handleQuery(question) {
    let sessionId = activeSession
    if (!sessionId) {
      sessionId = generateId()
      setActiveSession(sessionId)
    }

    const userMsg = { id: Date.now(), role: 'user', content: question }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setActiveSources(null)
    setSourceOpen(false)

    try {
      const res = await api.post('/query', {
        question,
        session_id: sessionId,
      })

      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
        metrics: res.data.metrics,
      }
      setMessages(prev => [...prev, assistantMsg])
      await fetchSessions()
    } catch (e) {
      const errMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: e.response?.data?.detail || 'Something went wrong. Please try again.',
        error: true,
      }
      setMessages(prev => [...prev, errMsg])
    } finally {
      setLoading(false)
    }
  }

  function handleViewSources(sources) {
    setActiveSources(sources)
    setSourceOpen(true)
  }

  return (
    <div className="app-layout">
      <Sidebar
        documents={documents}
        sessions={sessions}
        activeSession={activeSession}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onSelectSession={handleSelectSession}
        onDeleteSession={handleDeleteSession}
        onNewChat={handleNewChat}
        onClearAllSessions={handleClearAllSessions}
        uploading={uploading}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <ChatArea
        messages={messages}
        loading={loading}
        onSend={handleQuery}
        onViewSources={handleViewSources}
        hasDocuments={documents.length > 0}
        documentCount={documents.length}
        onUploadClick={() => mainUploadRef.current?.click()}
        mainUploadRef={mainUploadRef}
        onUploadFile={(file) => handleUpload(file, 500, 100)}
        uploading={uploading}
      />
      {sourceOpen && activeSources && (
        <SourcePanel
          sources={activeSources}
          onClose={() => setSourceOpen(false)}
        />
      )}
    </div>
  )
}
