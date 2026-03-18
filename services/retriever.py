from __future__ import annotations

import chromadb
from ddgs import DDGS
from langchain_community.embeddings import HuggingFaceEmbeddings

import config


COLLECTION_NAME = "indian_political_facts"
TRUSTED_SOURCES = ["pib.gov.in", "altnews.in", "factly.in", "boomlive.in", "vishvasnews.com"]


def _get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=config.CHROMA_DB_PATH)
    return client.get_or_create_collection(name=COLLECTION_NAME)


def _get_embedder() -> HuggingFaceEmbeddings:
    return HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")


def _normalize_confidence(distance: float) -> float:
    return max(0.0, min(1.0, 1.0 - float(distance)))


def rag_search(query: str, n_results: int = 5) -> tuple[list[dict], float]:
    collection = _get_collection()
    embedder = _get_embedder()

    query_embedding = embedder.embed_query(query)
    response = collection.query(
        query_embeddings=[query_embedding],
        n_results=n_results,
        include=["documents", "metadatas", "distances"],
    )

    documents = response.get("documents", [[]])[0]
    metadatas = response.get("metadatas", [[]])[0]
    distances = response.get("distances", [[]])[0]

    results: list[dict] = []
    for text, metadata, distance in zip(documents, metadatas, distances):
        md = metadata or {}
        results.append(
            {
                "text": text,
                "source": md.get("source_name", "unknown"),
                "url": md.get("url", ""),
                "distance": float(distance),
                "chunk_index": md.get("chunk_index", -1),
            }
        )

    top_confidence = _normalize_confidence(float(distances[0])) if distances else 0.0
    return results, top_confidence


def live_search(query: str, sources: list[str]) -> list[dict]:
    results: list[dict] = []
    seen_urls: set[str] = set()

    ddgs = DDGS()
    for source in sources:
        scoped_query = f"{query} site:{source}"
        try:
            for row in ddgs.text(scoped_query, region="in-en", max_results=5):
                url = str(row.get("href", "")).strip()
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                results.append(
                    {
                        "title": str(row.get("title", "")).strip(),
                        "body": str(row.get("body", "")).strip(),
                        "url": url,
                        "source": source,
                        "text": str(row.get("body", "")).strip(),
                    }
                )
        except Exception:
            continue

    return results


def hybrid_search(query: str) -> tuple[list[dict], str]:
    rag_results: list[dict] = []
    confidence: float = 0.0
    try:
        rag_results, confidence = rag_search(query)
    except Exception:
        pass  # ChromaDB may be empty or not yet indexed — fall back to live search

    if rag_results and confidence >= 0.75:
        return rag_results, "rag"

    live_results = live_search(query, sources=TRUSTED_SOURCES)
    if not rag_results:
        return live_results, "live_search"

    merged = [
        {
            "type": "rag",
            **item,
        }
        for item in rag_results
    ]
    merged.extend(
        {
            "type": "live",
            **item,
        }
        for item in live_results
    )
    return merged, "hybrid"
