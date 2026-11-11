import os
import shutil
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import UPLOAD_DIR, SUPPORTED_EXTENSIONS
from rag_engine import (
    ingest_document,
    delete_document,
    list_documents,
    query_rag,
    list_chat_sessions,
    load_chat_session,
    delete_chat_session,
)

app = FastAPI(title="RAG System API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    question: str
    session_id: str = None
    top_k_retrieval: int = 15
    top_k_rerank: int = 5


# ── Health ──

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Documents ──

@app.post("/api/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: int = 500,
    chunk_overlap: int = 100,
):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type: {ext}. Allowed: {', '.join(SUPPORTED_EXTENSIONS)}")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    save_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(save_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    try:
        meta = ingest_document(save_path, file.filename, chunk_size, chunk_overlap)
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(500, f"Failed to process document: {str(e)}")

    return {"message": "Document uploaded and indexed", "document": meta}


@app.get("/api/documents")
def get_documents():
    return {"documents": list_documents()}


@app.delete("/api/documents/{doc_id}")
def remove_document(doc_id: str):
    if delete_document(doc_id):
        return {"message": "Document deleted"}
    raise HTTPException(404, "Document not found")


# ── Chat sessions ──

@app.get("/api/sessions")
def get_sessions():
    return {"sessions": list_chat_sessions()}


@app.delete("/api/sessions")
def clear_all_sessions():
    sessions = list_chat_sessions()
    for s in sessions:
        delete_chat_session(s["id"])
    return {"message": f"Deleted {len(sessions)} sessions"}


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str):
    messages = load_chat_session(session_id)
    return {"session_id": session_id, "messages": messages}


@app.delete("/api/sessions/{session_id}")
def remove_session(session_id: str):
    if delete_chat_session(session_id):
        return {"message": "Session deleted"}
    raise HTTPException(404, "Session not found")


# ── Query ──

@app.post("/api/query")
def ask_question(req: QueryRequest):
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty")

    result = query_rag(
        question=req.question,
        session_id=req.session_id,
        top_k_retrieval=req.top_k_retrieval,
        top_k_rerank=req.top_k_rerank,
    )
    return result
