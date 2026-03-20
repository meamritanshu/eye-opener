from __future__ import annotations

import chromadb
from langchain_ollama import OllamaEmbeddings
from duckduckgo_search import DDGS

import config


COLLECTION_NAME = "indian_political_facts"
RAG_SOURCES = [
    "altnews.in",
    "factly.in",
    "boomlive.in",
    "vishvasnews.com",
    "scroll.in",
    "theprint.in",
    "thequint.com",
    "mygov.in",
    "indiankanoon.org",
    "prsindia.org",
    "rbi.org.in",
    "mospi.gov.in",
]

LIVE_ONLY_SOURCES = [
    "pib.gov.in",
    "thewire.in",
    "newslaundry.com",
    "sci.gov.in",
    "sansad.in",
    "data.gov.in",
    "eci.gov.in",
    "niti.gov.in",
]


def _live_sources() -> list[str]:
    # Keep deterministic order and avoid duplicates.
    return list(dict.fromkeys([*RAG_SOURCES, *LIVE_ONLY_SOURCES]))


def _category_priority(category: str) -> int:
    normalized = (category or "").strip().lower()
    if normalized in {"legal", "government"}:
        return 0
    return 1


def _get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=config.CHROMA_DB_PATH)
    return client.get_or_create_collection(name=COLLECTION_NAME)


def _get_embedder() -> OllamaEmbeddings:
    return OllamaEmbeddings(model="nomic-embed-text", base_url=config.OLLAMA_BASE_URL)


def _normalize_confidence(distance: float) -> float:
    return max(0.0, min(1.0, 1.0 - float(distance)))


def _is_legal_query(query: str) -> bool:
    text = query.lower()
    keywords = [
        "supreme court",
        "high court",
        "judgement",
        "judgment",
        "constitutional",
        "constitution",
        "act",
        "bill",
        "ordinance",
        "electoral bonds",
        "verdict",
    ]
    return any(term in text for term in keywords)


def rag_search(query: str, n_results: int = 5) -> tuple[list[dict], float]:
    try:
        collection = _get_collection()
        embedder = _get_embedder()

        query_embedding = embedder.embed_query(query)
        response = collection.query(
            query_embeddings=[query_embedding],
            n_results=n_results,
            include=["documents", "metadatas", "distances"],
        )

        raw_documents = response.get("documents") or [[]]
        raw_metadatas = response.get("metadatas") or [[]]
        raw_distances = response.get("distances") or [[]]

        documents = raw_documents[0] if raw_documents else []
        metadatas = raw_metadatas[0] if raw_metadatas else []
        distances = raw_distances[0] if raw_distances else []

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
                    "source_category": md.get("category", "general"),
                    "type": "rag",
                }
            )

        top_confidence = _normalize_confidence(float(distances[0])) if distances else 0.0
        return results, top_confidence
    except Exception as e:
        print(f"[RAG] ChromaDB not ready yet, falling back: {e}")
        return [], 0.0


def live_search(query: str, sources: list[str]) -> list[dict]:
    results: list[dict] = []
    seen_urls: set[str] = set()

    # Do 1 general search instead of 20 separate source-specific ones
    # to avoid DDGS rate limits and drastic slowdowns.
    try:
        with DDGS() as ddgs:
            for row in ddgs.text(query, region="in-en", max_results=10):
                url = str(row.get("href", "")).strip()
                if not url or url in seen_urls:
                    continue

                seen_urls.add(url)
                results.append(
                    {
                        "title": str(row.get("title", "")).strip(),
                        "body": str(row.get("body", "")).strip(),
                        "url": url,
                        "source": "web",
                        "type": "live",
                        "text": str(row.get("body", "")).strip(),
                    }
                )
    except Exception as e:
        import logging

        logging.getLogger(__name__).warning("DDGS live_search failed: %s", e)

    return results


def deep_legal_search_indiankanoon(query: str) -> list[dict]:
    queries = [f"{query} site:indiankanoon.org"]

    results: list[dict] = []
    seen_urls: set[str] = set()
    try:
        with DDGS() as ddgs:
            for scoped_query in queries:
                for row in ddgs.text(scoped_query, region="in-en", max_results=3):
                    url = str(row.get("href", "")).strip()
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    results.append(
                        {
                            "title": str(row.get("title", "")).strip(),
                            "body": str(row.get("body", "")).strip(),
                            "url": url,
                            "source": "indiankanoon.org",
                            "type": "live_legal",
                            "source_category": "legal",
                            "text": str(row.get("body", "")).strip(),
                        }
                    )
    except Exception:
        pass
    return results


def deep_pib_search(query: str) -> list[dict]:
    scoped_queries = [f"{query} site:pib.gov.in"]

    results: list[dict] = []
    seen_urls: set[str] = set()
    try:
        with DDGS() as ddgs:
            for scoped_query in scoped_queries:
                for row in ddgs.text(scoped_query, region="in-en", max_results=3):
                    url = str(row.get("href", "")).strip()
                    if not url or url in seen_urls:
                        continue
                    seen_urls.add(url)
                    results.append(
                        {
                            "title": str(row.get("title", "")).strip(),
                            "body": str(row.get("body", "")).strip(),
                            "url": url,
                            "source": "pib.gov.in",
                            "type": "live_pib",
                            "source_category": "government",
                            "text": str(row.get("body", "")).strip(),
                        }
                    )
    except Exception:
        pass

    return results


def hybrid_search(query: str) -> tuple[list[dict], str]:
    rag_results: list[dict] = []
    confidence: float = 0.0
    try:
        rag_results, confidence = rag_search(query)
    except Exception:
        pass  # ChromaDB may be empty or not yet indexed — fall back to live search
    rag_results = sorted(
        rag_results,
        key=lambda item: (
            _category_priority(str(item.get("source_category", "general"))),
            float(item.get("distance", 1.0)),
        ),
    )

    if rag_results and confidence >= 0.75:
        return rag_results, "rag"

    live_results = live_search(query, sources=_live_sources())
    pib_results = deep_pib_search(query)
    live_seen_urls = {str(item.get("url", "")) for item in live_results}
    live_results.extend(
        [item for item in pib_results if str(item.get("url", "")) not in live_seen_urls]
    )

    if _is_legal_query(query):
        legal_results = deep_legal_search_indiankanoon(query)
        seen_urls = {str(item.get("url", "")) for item in live_results}
        live_results.extend(
            [
                item
                for item in legal_results
                if str(item.get("url", "")) not in seen_urls
            ]
        )

    if not rag_results:
        return live_results, "live_search"

    merged = list(rag_results)
    merged.extend(live_results)

    return merged, "hybrid"
