import os
import uuid
import time
import json
import shutil
from typing import Optional

from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain.schema import SystemMessage, HumanMessage, AIMessage
from sentence_transformers import CrossEncoder

from config import (
    GROQ_API_KEY,
    UPLOAD_DIR,
    VECTORSTORE_DIR,
    CHAT_HISTORY_DIR,
    EMBEDDING_MODEL,
    RERANKER_MODEL,
    LLM_MODEL,
    DEFAULT_CHUNK_SIZE,
    DEFAULT_CHUNK_OVERLAP,
    DEFAULT_TOP_K_RETRIEVAL,
    DEFAULT_TOP_K_RERANK,
    MAX_CHAT_HISTORY,
)

for d in [UPLOAD_DIR, VECTORSTORE_DIR, CHAT_HISTORY_DIR]:
    os.makedirs(d, exist_ok=True)

embeddings = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
reranker = CrossEncoder(RERANKER_MODEL)

DOCUMENTS_META_PATH = os.path.join(UPLOAD_DIR, "documents.json")


# ── Document metadata persistence ──

def _load_documents_meta() -> list[dict]:
    if os.path.exists(DOCUMENTS_META_PATH):
        with open(DOCUMENTS_META_PATH, "r") as f:
            return json.load(f)
    return []


def _save_documents_meta(docs: list[dict]):
    with open(DOCUMENTS_META_PATH, "w") as f:
        json.dump(docs, f, indent=2)


# ── Chat session persistence ──

def _session_path(session_id: str) -> str:
    return os.path.join(CHAT_HISTORY_DIR, f"{session_id}.json")


def load_chat_session(session_id: str) -> list[dict]:
    path = _session_path(session_id)
    if os.path.exists(path):
        with open(path, "r") as f:
            return json.load(f)
    return []


def save_chat_session(session_id: str, messages: list[dict]):
    with open(_session_path(session_id), "w") as f:
        json.dump(messages, f, indent=2)


def list_chat_sessions() -> list[dict]:
    sessions = []
    for fname in sorted(os.listdir(CHAT_HISTORY_DIR), reverse=True):
        if not fname.endswith(".json"):
            continue
        sid = fname[:-5]
        path = os.path.join(CHAT_HISTORY_DIR, fname)
        with open(path, "r") as f:
            msgs = json.load(f)
        if not msgs:
            continue
        first_q = next((m["content"] for m in msgs if m["role"] == "user"), "New chat")
        sessions.append({
            "id": sid,
            "title": first_q[:80],
            "message_count": len(msgs),
            "updated_at": time.strftime(
                "%Y-%m-%d %H:%M:%S",
                time.localtime(os.path.getmtime(path)),
            ),
        })
    return sessions


def delete_chat_session(session_id: str) -> bool:
    path = _session_path(session_id)
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


# ── Document ingestion ──

def ingest_document(
    file_path: str,
    original_name: str,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> dict:
    ext = os.path.splitext(original_name)[1].lower()
    if ext == ".pdf":
        loader = PyPDFLoader(file_path)
    elif ext == ".txt":
        loader = TextLoader(file_path, encoding="utf-8")
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    raw_docs = loader.load()

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks = splitter.split_documents(raw_docs)

    doc_id = uuid.uuid4().hex[:12]

    for chunk in chunks:
        chunk.metadata["doc_id"] = doc_id
        chunk.metadata["source_name"] = original_name

    vectorstore = FAISS.from_documents(chunks, embeddings)
    vs_path = os.path.join(VECTORSTORE_DIR, doc_id)
    vectorstore.save_local(vs_path)

    file_size = os.path.getsize(file_path)

    meta = {
        "id": doc_id,
        "name": original_name,
        "chunks": len(chunks),
        "pages": len(raw_docs),
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "file_size": file_size,
        "ingested_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }

    docs = _load_documents_meta()
    docs.append(meta)
    _save_documents_meta(docs)

    return meta


def delete_document(doc_id: str) -> bool:
    docs = _load_documents_meta()
    found = [d for d in docs if d["id"] == doc_id]
    if not found:
        return False

    docs = [d for d in docs if d["id"] != doc_id]
    _save_documents_meta(docs)

    vs_path = os.path.join(VECTORSTORE_DIR, doc_id)
    if os.path.exists(vs_path):
        shutil.rmtree(vs_path)

    return True


def list_documents() -> list[dict]:
    return _load_documents_meta()


# ── Vector store operations ──

def _load_all_vectorstores() -> Optional[FAISS]:
    docs = _load_documents_meta()
    if not docs:
        return None

    merged = None
    for doc in docs:
        vs_path = os.path.join(VECTORSTORE_DIR, doc["id"])
        if not os.path.exists(vs_path):
            continue
        vs = FAISS.load_local(vs_path, embeddings, allow_dangerous_deserialization=True)
        if merged is None:
            merged = vs
        else:
            merged.merge_from(vs)
    return merged


# ── Reranking ──

def rerank_docs(query: str, docs: list, top_k: int = DEFAULT_TOP_K_RERANK) -> list:
    if not docs:
        return []
    pairs = [[query, doc.page_content] for doc in docs]
    scores = reranker.predict(pairs)
    scored = sorted(zip(docs, scores), key=lambda x: x[1], reverse=True)
    return scored[:top_k]


# ── Query pipeline ──

SYSTEM_PROMPT = """You are an expert assistant that answers questions using document context.

Guidelines:
- Provide clear, well-structured answers based on the context
- When multiple sources are relevant, synthesize information across them
- Cite the source document and page number when referencing specific information
- If the context partially answers the question, provide what you can and note what's missing
- If the context doesn't contain relevant information, say so clearly
- Use bullet points or numbered lists for complex answers
- Be thorough but concise"""


def query_rag(
    question: str,
    session_id: str = None,
    top_k_retrieval: int = DEFAULT_TOP_K_RETRIEVAL,
    top_k_rerank: int = DEFAULT_TOP_K_RERANK,
) -> dict:
    start = time.time()

    vectorstore = _load_all_vectorstores()
    if vectorstore is None:
        return {
            "answer": "No documents uploaded yet. Please upload a document first.",
            "sources": [],
            "metrics": {},
        }

    chat_history = []
    if session_id:
        chat_history = load_chat_session(session_id)

    retriever = vectorstore.as_retriever(search_kwargs={"k": top_k_retrieval})
    retrieved = retriever.invoke(question)

    scored_docs = rerank_docs(question, retrieved, top_k_rerank)
    top_docs = [doc for doc, _ in scored_docs]
    top_scores = [round(float(score), 4) for _, score in scored_docs]

    context = "\n\n---\n\n".join(
        [f"[Source: {doc.metadata.get('source_name', 'Unknown')}, "
         f"Page {doc.metadata.get('page', 'N/A')}]\n{doc.page_content}"
         for doc in top_docs]
    )

    messages = [SystemMessage(content=SYSTEM_PROMPT)]

    if chat_history:
        recent = chat_history[-MAX_CHAT_HISTORY:]
        for m in recent:
            if m["role"] == "user":
                messages.append(HumanMessage(content=m["content"]))
            else:
                messages.append(AIMessage(content=m["content"]))

    user_prompt = f"""Context from documents:
{context}

Question: {question}"""

    messages.append(HumanMessage(content=user_prompt))

    llm = ChatGroq(
        model_name=LLM_MODEL,
        temperature=0.2,
        api_key=GROQ_API_KEY,
    )

    response = llm.invoke(messages)

    latency = round(time.time() - start, 2)

    if session_id:
        chat_history.append({"role": "user", "content": question})
        chat_history.append({"role": "assistant", "content": response.content})
        save_chat_session(session_id, chat_history)

    sources = []
    for i, doc in enumerate(top_docs):
        sources.append({
            "index": i + 1,
            "document": doc.metadata.get("source_name", "Unknown"),
            "page": doc.metadata.get("page", "N/A"),
            "relevance_score": top_scores[i] if i < len(top_scores) else 0,
            "snippet": doc.page_content[:400],
        })

    return {
        "answer": response.content,
        "sources": sources,
        "metrics": {
            "latency_seconds": latency,
            "documents_retrieved": len(retrieved),
            "documents_after_rerank": len(top_docs),
            "context_length": len(context),
        },
    }
