import logging
import os
import sqlite3
from datetime import datetime, timezone

import keyring

logger = logging.getLogger("hooman.db")

KEYRING_SERVICE = "hooman-ai"


DB_PATH = os.path.join(os.path.dirname(__file__), "hooman.db")


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Keyring helpers ────────────────────────────────────────────────────────────

def _save_key(provider_id: str, api_key: str) -> None:
    if api_key:
        keyring.set_password(KEYRING_SERVICE, provider_id, api_key)

def _get_key(provider_id: str) -> str:
    try:
        return keyring.get_password(KEYRING_SERVICE, provider_id) or ""
    except Exception:
        return ""

def _delete_key(provider_id: str) -> None:
    try:
        keyring.delete_password(KEYRING_SERVICE, provider_id)
    except Exception:
        pass


def init_db():
    conn = get_db_connection()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS providers (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            base_url TEXT DEFAULT '',
            api_key TEXT DEFAULT '',
            model TEXT NOT NULL,
            is_active INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB,
            source TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS folders (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            position INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS user_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS usage_log (
            id TEXT PRIMARY KEY,
            session_id TEXT,
            model TEXT NOT NULL,
            provider_type TEXT NOT NULL,
            input_chars INTEGER DEFAULT 0,
            output_chars INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        );
    """)
    # Safe column migrations
    for sql in [
        "ALTER TABLE chunks ADD COLUMN source TEXT DEFAULT ''",
        "ALTER TABLE sessions ADD COLUMN pinned INTEGER DEFAULT 0",
        "ALTER TABLE sessions ADD COLUMN folder_id TEXT",
    ]:
        try:
            conn.execute(sql)
            conn.commit()
        except Exception:
            pass
    conn.commit()
    conn.close()
    _migrate_keys_to_keyring()
    seed_default_providers()


def create_session(session_id: str, title: str):
    conn = get_db_connection()
    conn.execute(
        "INSERT OR IGNORE INTO sessions (id, title, created_at) VALUES (?, ?, ?)",
        (session_id, title, now_iso()),
    )
    conn.commit()
    conn.close()


def get_sessions():
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT
            s.id, s.title, s.summary, s.created_at, s.pinned, s.folder_id,
            COUNT(m.id) AS message_count,
            MAX(m.created_at) AS last_message_at
        FROM sessions s
        LEFT JOIN messages m ON m.session_id = s.id
        GROUP BY s.id
        ORDER BY s.pinned DESC, COALESCE(MAX(m.created_at), s.created_at) DESC
    """).fetchall()
    conn.close()
    return [
        {
            "id": row["id"],
            "title": row["title"],
            "summary": row["summary"],
            "created_at": row["created_at"],
            "pinned": bool(row["pinned"]),
            "folder_id": row["folder_id"],
            "message_count": row["message_count"],
            "last_message_at": row["last_message_at"],
        }
        for row in rows
    ]


def get_session(session_id: str):
    conn = get_db_connection()
    row = conn.execute(
        "SELECT id, title, summary, created_at FROM sessions WHERE id = ?",
        (session_id,),
    ).fetchone()
    conn.close()
    if row:
        return {
            "id": row["id"],
            "title": row["title"],
            "summary": row["summary"],
            "created_at": row["created_at"],
        }
    return None


def rename_session(session_id: str, new_title: str):
    conn = get_db_connection()
    conn.execute("UPDATE sessions SET title = ? WHERE id = ?", (new_title, session_id))
    conn.commit()
    conn.close()


def delete_session(session_id: str):
    conn = get_db_connection()
    conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()


def save_message(message_id: str, session_id: str, role: str, content: str):
    conn = get_db_connection()
    conn.execute(
        "INSERT OR IGNORE INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
        (message_id, session_id, role, content, now_iso()),
    )
    conn.commit()
    conn.close()


def get_session_messages(session_id: str):
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    return [
        {
            "id": row["id"],
            "session_id": row["session_id"],
            "role": row["role"],
            "content": row["content"],
            "created_at": row["created_at"],
        }
        for row in rows
    ]


def update_session_summary(session_id: str, summary: str):
    conn = get_db_connection()
    conn.execute("UPDATE sessions SET summary = ? WHERE id = ?", (summary, session_id))
    conn.commit()
    conn.close()


def mask_key(api_key: str) -> str:
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "configured"
    return f"{api_key[:4]}...{api_key[-4:]}"


def _serialize_provider(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "provider_type": row["provider_type"],
        "base_url": row["base_url"],
        "api_key_masked": mask_key(_get_key(row["id"])),
        "model": row["model"],
        "is_active": bool(row["is_active"]),
        "created_at": row["created_at"],
    }


def _migrate_keys_to_keyring():
    """One-time migration: move plaintext api_keys from DB rows into OS keyring."""
    conn = get_db_connection()
    rows = conn.execute("SELECT id, api_key FROM providers WHERE api_key != ''").fetchall()
    migrated = 0
    for row in rows:
        if row["api_key"] and not _get_key(row["id"]):
            _save_key(row["id"], row["api_key"])
            migrated += 1
    if migrated:
        conn.execute("UPDATE providers SET api_key = '' WHERE api_key != ''")
        conn.commit()
        logger.info(f"Migrated {migrated} provider key(s) to OS keyring")
    conn.close()


def seed_default_providers():
    defaults = [
        {
            "id": "00000000-0000-0000-0000-000000000001",
            "name": "Claude",
            "provider_type": "anthropic",
            "base_url": "",
            "api_key": os.getenv("ANTHROPIC_API_KEY", ""),
            "model": os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        },
        {
            "id": "00000000-0000-0000-0000-000000000002",
            "name": "Ollama",
            "provider_type": "ollama",
            "base_url": os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1"),
            "api_key": "ollama",
            "model": os.getenv("OLLAMA_MODEL", "qwen3:14b"),
        },
        {
            "id": "00000000-0000-0000-0000-000000000003",
            "name": "Groq",
            "provider_type": "openai_compatible",
            "base_url": "https://api.groq.com/openai/v1",
            "api_key": os.getenv("GROQ_API_KEY", ""),
            "model": os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
        },
    ]
    active_env = os.getenv("ACTIVE_PROVIDER", "ollama")
    conn = get_db_connection()
    for item in defaults:
        is_active = 1 if item["provider_type"] == active_env or (active_env == "groq" and item["provider_type"] == "openai_compatible") else 0
        conn.execute(
            """
            INSERT OR IGNORE INTO providers (id, name, provider_type, base_url, api_key, model, is_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (item["id"], item["name"], item["provider_type"], item["base_url"], "", item["model"], is_active, now_iso()),
        )
        if item.get("api_key") and not _get_key(item["id"]):
            _save_key(item["id"], item["api_key"])
    has_active = conn.execute("SELECT COUNT(*) FROM providers WHERE is_active = 1").fetchone()[0]
    if not has_active:
        conn.execute(
            "UPDATE providers SET is_active = 1 WHERE id = ?",
            ("00000000-0000-0000-0000-000000000002",),
        )
    conn.commit()
    conn.close()


def get_providers(include_keys: bool = False):
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM providers ORDER BY created_at ASC").fetchall()
    conn.close()
    if include_keys:
        return [dict(row) for row in rows]
    return [_serialize_provider(row) for row in rows]


def get_provider_config(provider_id: str | None = None):
    conn = get_db_connection()
    if provider_id:
        row = conn.execute("SELECT * FROM providers WHERE id = ?", (provider_id,)).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM providers WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1"
        ).fetchone()
    conn.close()
    if not row:
        return None
    config = dict(row)
    config["api_key"] = _get_key(row["id"])
    return config


def create_provider(provider_id: str, data: dict):
    api_key = data.get("api_key", "").strip()
    _save_key(provider_id, api_key)
    conn = get_db_connection()
    if data.get("is_active"):
        conn.execute("UPDATE providers SET is_active = 0")
    conn.execute(
        "INSERT INTO providers (id, name, provider_type, base_url, api_key, model, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (
            provider_id,
            data["name"],
            data["provider_type"],
            data.get("base_url", ""),
            "",
            data["model"],
            1 if data.get("is_active") else 0,
            now_iso(),
        ),
    )
    conn.commit()
    conn.close()


def update_provider(provider_id: str, data: dict):
    existing = get_provider_config(provider_id)
    if not existing:
        return
    new_key = data.get("api_key", "").strip()
    if new_key:
        _save_key(provider_id, new_key)
    make_active = bool(data.get("is_active"))
    # Sticky active: "Make active" promotes; unchecking does not demote
    keep_active = bool(existing.get("is_active", False))
    conn = get_db_connection()
    if make_active:
        conn.execute("UPDATE providers SET is_active = 0")
    conn.execute(
        "UPDATE providers SET name=?, provider_type=?, base_url=?, model=?, is_active=? WHERE id=?",
        (
            data["name"],
            data["provider_type"],
            data.get("base_url", ""),
            data["model"],
            1 if (make_active or keep_active) else 0,
            provider_id,
        ),
    )
    conn.commit()
    conn.close()


def delete_provider(provider_id: str):
    _delete_key(provider_id)
    conn = get_db_connection()
    conn.execute("DELETE FROM providers WHERE id = ?", (provider_id,))
    has_active = conn.execute("SELECT COUNT(*) FROM providers WHERE is_active = 1").fetchone()[0]
    if not has_active:
        conn.execute(
            "UPDATE providers SET is_active = 1 WHERE id = (SELECT id FROM providers ORDER BY created_at ASC LIMIT 1)"
        )
    conn.commit()
    conn.close()


def save_chunk(chunk_id: str, session_id: str, content: str, embedding: bytes, source: str = ""):
    conn = get_db_connection()
    conn.execute(
        "INSERT OR IGNORE INTO chunks (id, session_id, content, embedding, source, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (chunk_id, session_id, content, embedding, source, now_iso()),
    )
    conn.commit()
    conn.close()


def get_session_sources(session_id: str) -> list[str]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT DISTINCT source FROM chunks WHERE session_id = ? AND source != '' ORDER BY source",
        (session_id,),
    ).fetchall()
    conn.close()
    return [row["source"] for row in rows]


def get_chunks_for_session(session_id: str) -> list[dict]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, session_id, content, embedding, source FROM chunks WHERE session_id = ?",
        (session_id,),
    ).fetchall()
    conn.close()
    return [
        {
            "id": row["id"],
            "session_id": row["session_id"],
            "content": row["content"],
            "embedding": bytes(row["embedding"]) if row["embedding"] else b"",
            "source": row["source"] or "",
        }
        for row in rows
    ]


# ── Pin / Folder ───────────────────────────────────────────────────────────────

def toggle_pin_session(session_id: str) -> bool:
    conn = get_db_connection()
    row = conn.execute("SELECT pinned FROM sessions WHERE id = ?", (session_id,)).fetchone()
    if not row:
        conn.close()
        return False
    new_pin = 0 if row["pinned"] else 1
    conn.execute("UPDATE sessions SET pinned = ? WHERE id = ?", (new_pin, session_id))
    conn.commit()
    conn.close()
    return bool(new_pin)


def set_session_folder(session_id: str, folder_id: str | None) -> None:
    conn = get_db_connection()
    conn.execute("UPDATE sessions SET folder_id = ? WHERE id = ?", (folder_id, session_id))
    conn.commit()
    conn.close()


def get_folders() -> list[dict]:
    conn = get_db_connection()
    rows = conn.execute(
        "SELECT id, name, position, created_at FROM folders ORDER BY position ASC, created_at ASC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_folder(folder_id: str, name: str) -> None:
    conn = get_db_connection()
    pos = conn.execute("SELECT COUNT(*) FROM folders").fetchone()[0]
    conn.execute(
        "INSERT INTO folders (id, name, position, created_at) VALUES (?, ?, ?, ?)",
        (folder_id, name, pos, now_iso()),
    )
    conn.commit()
    conn.close()


def rename_folder(folder_id: str, name: str) -> None:
    conn = get_db_connection()
    conn.execute("UPDATE folders SET name = ? WHERE id = ?", (name, folder_id))
    conn.commit()
    conn.close()


def delete_folder(folder_id: str) -> None:
    conn = get_db_connection()
    conn.execute("UPDATE sessions SET folder_id = NULL WHERE folder_id = ?", (folder_id,))
    conn.execute("DELETE FROM folders WHERE id = ?", (folder_id,))
    conn.commit()
    conn.close()


# ── User settings ──────────────────────────────────────────────────────────────

def get_user_setting(key: str, default: str = "") -> str:
    conn = get_db_connection()
    row = conn.execute("SELECT value FROM user_settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_user_setting(key: str, value: str) -> None:
    conn = get_db_connection()
    conn.execute("INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()


def get_all_user_settings() -> dict:
    conn = get_db_connection()
    rows = conn.execute("SELECT key, value FROM user_settings").fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}


# ── Usage tracking ─────────────────────────────────────────────────────────────

def log_usage(usage_id: str, session_id: str, model: str, provider_type: str, input_chars: int, output_chars: int) -> None:
    conn = get_db_connection()
    conn.execute(
        "INSERT INTO usage_log (id, session_id, model, provider_type, input_chars, output_chars, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (usage_id, session_id, model, provider_type, input_chars, output_chars, now_iso()),
    )
    conn.commit()
    conn.close()


def get_usage_stats() -> list[dict]:
    conn = get_db_connection()
    rows = conn.execute("""
        SELECT model, provider_type,
               COUNT(*) AS requests,
               SUM(input_chars) AS total_input_chars,
               SUM(output_chars) AS total_output_chars,
               MAX(created_at) AS last_used
        FROM usage_log
        GROUP BY model, provider_type
        ORDER BY requests DESC
    """).fetchall()
    conn.close()
    return [dict(r) for r in rows]
