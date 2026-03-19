import sqlite3
import json
import os
from contextlib import closing

CACHE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "local_cache.db")

def _init_db():
    with sqlite3.connect(CACHE_DB_PATH) as conn:
        with closing(conn.cursor()) as cursor:
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS AnswersCache (
                    query TEXT PRIMARY KEY,
                    state_json TEXT
                )
            ''')
        conn.commit()

_init_db()

def _normalize(query: str) -> str:
    """Normalize the query by lowercasing and standardizing whitespace."""
    return " ".join(query.strip().split()).lower()

def get_cached_state(query: str) -> dict | None:
    norm_query = _normalize(query)
    if not norm_query:
        return None
        
    try:
        with sqlite3.connect(CACHE_DB_PATH) as conn:
            with closing(conn.cursor()) as cursor:
                cursor.execute("SELECT state_json FROM AnswersCache WHERE query = ?", (norm_query,))
                row = cursor.fetchone()
                if row:
                    return json.loads(row[0])
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to get cache for query '%s': %s", query, e)
    return None

def set_cached_state(query: str, state: dict) -> None:
    norm_query = _normalize(query)
    if not norm_query:
        return
        
    try:
        with sqlite3.connect(CACHE_DB_PATH) as conn:
            with closing(conn.cursor()) as cursor:
                cursor.execute(
                    "INSERT OR REPLACE INTO AnswersCache (query, state_json) VALUES (?, ?)", 
                    (norm_query, json.dumps(state))
                )
            conn.commit()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Failed to set cache for query '%s': %s", query, e)
