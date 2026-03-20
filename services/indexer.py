from __future__ import annotations

import time
from datetime import datetime, timezone
from hashlib import sha1
from typing import Iterable

import chromadb
import requests
from bs4 import BeautifulSoup
from langchain_ollama import OllamaEmbeddings

import config


SOURCES = [
    # Fact-checking sites
    {
        "name": "AltNews",
        "url": "https://www.altnews.in/",
        "pages": [
            "https://www.altnews.in/",
            "https://www.altnews.in/category/politics/",
            "https://www.altnews.in/category/india/",
            "https://www.altnews.in/page/2/",
            "https://www.altnews.in/page/3/",
        ],
        "selector": "article",
        "category": "fact_check",
    },
    
    {
        "name": "Factly",
        "url": "https://factly.in/category/fact-check/",
        "pages": [
            "https://factly.in/category/fact-check/",
            "https://factly.in/category/political-fact-check/",
            "https://factly.in/page/2/",
            "https://factly.in/page/3/",
        ],
        "selector": "article",
        "category": "fact_check",
    },
    {
        "name": "BoomLive",
        "url": "https://www.boomlive.in/fact-check",
        "pages": ["https://www.boomlive.in/fact-check"],
        "selector": "a[href*='/fact-check/']",
        "fallback_selector": None,
        "category": "fact_check",
    },
    {
        "name": "VishvasNews",
        "url": "https://www.vishvasnews.com/",
        "pages": ["https://www.vishvasnews.com/"],
        "selector": "a[href*='vishvasnews.com']",
        "fallback_selector": "h2 a",
        "category": "fact_check",
    },
    # Independent journalism
    {
        "name": "ScrollIn",
        "url": "https://scroll.in/latest",
        "pages": ["https://scroll.in/latest"],
        "selector": "a[href*='/article/']",
        "fallback_selector": None,
        "category": "journalism",
    },
    {
        "name": "TheWire",
        "url": "https://thewire.in/politics",
        "pages": ["https://thewire.in/politics"],
        "selector": "article",
        "category": "journalism",
        "fetch_mode": "playwright",
        "skip": False,
    },
    {
        "name": "ThePrint",
        "url": "https://theprint.in/politics/",
        "pages": ["https://theprint.in/politics/"],
        "selector": "h3.entry-title a",
        "fallback_selector": "div.td_module_wrap",
        "category": "journalism",
    },
    {
        "name": "Newslaundry",
        "url": "https://www.newslaundry.com/politics",
        "pages": ["https://www.newslaundry.com/politics"],
        "selector": "article",
        "category": "journalism",
        "fetch_mode": "playwright",
        "skip": False,
    },
    {
        "name": "TheQuint",
        "url": "https://www.thequint.com/news/politics",
        "pages": ["https://www.thequint.com/news/politics"],
        "selector": "a[href*='/news/']",
        "fallback_selector": None,
        "category": "journalism",
    },
    # Government primary sources
    {
        "name": "PIB",
        "url": "https://pib.gov.in/allRel.aspx",
        "pages": ["https://pib.gov.in/allRel.aspx"],
        "selector": "div.content-area",
        "category": "government",
        "fetch_mode": "playwright",
        "skip": False,
    },
    {
        "name": "MyGov",
        "url": "https://www.mygov.in/",
        "pages": ["https://www.mygov.in/"],
        "selector": "div.views-row",
        "category": "government",
    },
    {
        "name": "DataGovIn",
        "url": "https://data.gov.in/",
        "pages": ["https://data.gov.in/"],
        "selector": "div.views-row",
        "category": "government",
        "skip": True,
        "skip_reason": "no reliable selector found",
    },
    {
        "name": "PRSIndia",
        "url": "https://prsindia.org/bills",
        "pages": ["https://prsindia.org/bills"],
        "selector": "a[href*='bill']",
        "fallback_selector": None,
        "category": "parliament",
        "skip": True,
        "skip_reason": "404 on HTTP fetch, content requires JS rendering",
    },
    {
        "name": "SansadIn",
        "url": "https://sansad.in/ls/questions",
        "pages": ["https://sansad.in/ls/questions"],
        "selector": "div.questions-listing",
        "category": "parliament",
        "fetch_mode": "playwright",
        "skip": False,
    },
    {
        "name": "ECIGovIn",
        "url": "https://www.eci.gov.in/",
        "pages": ["https://www.eci.gov.in/"],
        "selector": "div.content-area",
        "category": "government",
        "skip": True,
        "skip_reason": "no reliable selector found",
    },
    # Court documents
    {
        "name": "IndianKanoon",
        "url": "https://indiankanoon.org/search/?formInput=constitution+india&pagenum=1",
        "pages": [
            "https://indiankanoon.org/search/?formInput=electoral+bonds&pagenum=1",
            "https://indiankanoon.org/search/?formInput=supreme+court+india+2024&pagenum=1",
            "https://indiankanoon.org/search/?formInput=fundamental+rights&pagenum=1",
            "https://indiankanoon.org/search/?formInput=parliament+act&pagenum=1",
        ],
        "selector": "a[href*='/doc/']",
        "fallback_selector": None,
        "category": "legal",
    },
    {
        "name": "SupremeCourt",
        "url": "https://www.sci.gov.in/judgements",
        "pages": ["https://www.sci.gov.in/judgements"],
        "selector": "div.judgements",
        "category": "legal",
        "fetch_mode": "playwright",
        "skip": False,
    },
    # Economic and statistical
    {
        "name": "RBI",
        "url": "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx",
        "pages": [
            "https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx",
            "https://www.rbi.org.in/Scripts/AnnualReportPublications.aspx",
        ],
        "selector": "a[href*='PressRelease']",
        "fallback_selector": "table",
        "category": "economic",
    },
    {
        "name": "MoSPI",
        "url": "https://mospi.gov.in/web/mospi/home",
        "pages": ["https://mospi.gov.in/web/mospi/home"],
        "selector": "div.news-section",
        "fallback_selector": None,
        "category": "economic",
        "fetch_mode": "playwright",
        "skip": False,
    },
    {
        "name": "NITIAayog",
        "url": "https://www.niti.gov.in/",
        "pages": ["https://www.niti.gov.in/"],
        "selector": "div.view-content",
        "category": "economic",
        "fetch_mode": "playwright",
        "skip": False,
    },
    {
        "name": "Wikipedia_India",
        "url": "https://en.wikipedia.org/wiki/Politics_of_India",
        "selector": "div.mw-parser-output p",
        "category": "reference",
        "fetch_mode": "static",
    },
    {
        "name": "Wikipedia_SC",
        "url": "https://en.wikipedia.org/wiki/Supreme_Court_of_India",
        "selector": "div.mw-parser-output p",
        "category": "legal",
        "fetch_mode": "static",
    },
    {
        "name": "Wikipedia_Econ",
        "url": "https://en.wikipedia.org/wiki/Economy_of_India",
        "selector": "div.mw-parser-output p",
        "category": "economic",
        "fetch_mode": "static",
    },
]

COLLECTION_NAME = "indian_political_facts"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 100
USER_AGENT = "EyeOpenerIndexer/1.0 (+https://localhost)"


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    clean = " ".join(text.split())
    if not clean:
        return []

    chunks: list[str] = []
    start = 0
    step = max(1, chunk_size - overlap)
    while start < len(clean):
        end = min(len(clean), start + chunk_size)
        chunk = clean[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(clean):
            break
        start += step
    return chunks


def _extract_source_text(html: str, selector: str, fallback_selector: str | None = None) -> str:
    soup = BeautifulSoup(html, "html.parser")
    nodes = soup.select(selector)
    if not nodes and fallback_selector:
        nodes = soup.select(fallback_selector)
    if not nodes:
        return ""
    return "\n".join(node.get_text(" ", strip=True) for node in nodes)


def _fetch_source(url: str) -> str:
    response = requests.get(
        url,
        timeout=20,
        headers={"User-Agent": USER_AGENT},
    )
    response.raise_for_status()
    return response.text


def _fetch_with_playwright(url: str, selector: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_extra_http_headers({"User-Agent": USER_AGENT})
        page.goto(url, timeout=30000, wait_until="networkidle")
        page.wait_for_timeout(2000)
        elements = page.query_selector_all(selector)
        text = "\n".join(
            [el.inner_text() for el in elements if el.inner_text().strip()]
        )
        browser.close()
        return text


def _build_ids(source_name: str, source_url: str, chunks: Iterable[str]) -> list[str]:
    ids: list[str] = []
    for index, chunk in enumerate(chunks):
        digest = sha1(f"{source_name}|{source_url}|{index}|{chunk}".encode("utf-8")).hexdigest()[:16]
        ids.append(f"{source_name.lower()}-{index}-{digest}")
    return ids


def _get_embedder() -> OllamaEmbeddings:
    return OllamaEmbeddings(model="nomic-embed-text", base_url=config.OLLAMA_BASE_URL)


def _get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=config.CHROMA_DB_PATH)
    return client.get_or_create_collection(name=COLLECTION_NAME)


def index_all_sources() -> None:
    import config

    if hasattr(config, 'IS_PRODUCTION') and config.IS_PRODUCTION:
        print('[INDEXER] Running in production mode - building fresh index...')
    print("Starting index build...")
    collection = _get_collection()
    embedder = _get_embedder()

    scraped_at = datetime.now(timezone.utc).isoformat()

    for source in SOURCES:
        name = source["name"]

        if source.get("skip"):
            print(f"[SKIP] {name}: {source.get('skip_reason', 'source marked to skip')}")
            continue

        pages = source.get("pages", [source["url"]])
        selector = source["selector"]
        fallback_selector = source.get("fallback_selector")
        fetch_mode = source.get("fetch_mode", "static")

        for page_url in pages:
            print(f"[INDEX] Fetching {name}: {page_url}")
            try:
                if fetch_mode == "playwright":
                    extracted = _fetch_with_playwright(page_url, selector)
                else:
                    html = _fetch_source(page_url)
                    extracted = _extract_source_text(html, selector, fallback_selector)
                chunks = _chunk_text(extracted)

                if not chunks:
                    print(f"[SKIP] {name}: no extractable content for selector '{selector}'")
                else:
                    embeddings = embedder.embed_documents(chunks)
                    ids = _build_ids(name, page_url, chunks)
                    metadatas = [
                        {
                            "source_name": name,
                            "url": page_url,
                            "scraped_at": scraped_at,
                            "chunk_index": i,
                            "category": source.get("category", "general"),
                        }
                        for i, _ in enumerate(chunks)
                    ]

                    collection.upsert(
                        ids=ids,
                        documents=chunks,
                        embeddings=embeddings,
                        metadatas=metadatas,
                    )

                    print(f"[DONE] {name}: indexed {len(chunks)} chunks from {page_url}")
            except Exception as exc:
                print(f"[ERROR] {name}: {exc}")

            time.sleep(2)

    print("Index build complete.")


def verify_selectors_with_playwright(source_names: list[str] | None = None) -> None:
    try:
        from playwright.sync_api import sync_playwright
    except Exception as exc:
        print(f"[ERROR] Playwright is not available: {exc}")
        print("Install with: pip install playwright && playwright install")
        return

    selected_sources = SOURCES
    if source_names:
        requested = {name.strip().lower() for name in source_names if name.strip()}
        selected_sources = [src for src in SOURCES if src["name"].lower() in requested]

    if not selected_sources:
        print("[WARN] No matching sources to validate.")
        return

    print(f"[INFO] Validating {len(selected_sources)} source selectors with Playwright...")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        for source in selected_sources:
            name = source["name"]
            url = source["url"]
            selector = source["selector"]

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=30000)
                page.wait_for_timeout(1500)
                count = page.locator(selector).count()

                if count > 0:
                    print(f"[OK] {name}: selector '{selector}' matched {count} elements")
                else:
                    print(f"[FAIL] {name}: selector '{selector}' matched 0 elements")
            except Exception as exc:
                print(f"[FAIL] {name}: selector '{selector}' check errored - {exc}")

        browser.close()


if __name__ == "__main__":
    index_all_sources()
