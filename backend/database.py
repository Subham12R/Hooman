import os
import psycopg2
from psycopg2.extras import RealDictCursor

DATABASE_URL = os.getenv("DATABASE_URL")

def get_db_connection():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set in the environment variables.")
    conn = psycopg2.connect(DATABASE_URL)
    return conn

def init_db():
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id UUID PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT DEFAULT '',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY,
            session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
            role VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS providers (
            id UUID PRIMARY KEY,
            name TEXT NOT NULL,
            provider_type VARCHAR(40) NOT NULL,
            base_url TEXT DEFAULT '',
            api_key TEXT DEFAULT '',
            model TEXT NOT NULL,
            is_active BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """)
        conn.commit()
    conn.close()
    seed_default_providers()

def create_session(session_id: str, title: str):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO sessions (id, title) VALUES (%s, %s) ON CONFLICT (id) DO NOTHING;",
            (session_id, title)
        )
        conn.commit()
    conn.close()

def get_sessions():
    conn = get_db_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("""
            SELECT
                s.id,
                s.title,
                s.summary,
                s.created_at,
                COUNT(m.id) AS message_count,
                MAX(m.created_at) AS last_message_at
            FROM sessions s
            LEFT JOIN messages m ON m.session_id = s.id
            GROUP BY s.id
            ORDER BY COALESCE(MAX(m.created_at), s.created_at) DESC;
        """)
        rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": str(row["id"]),
            "title": row["title"],
            "summary": row["summary"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None,
            "message_count": row["message_count"],
            "last_message_at": row["last_message_at"].isoformat() if row["last_message_at"] else None
        }
        for row in rows
    ]

def get_session(session_id: str):
    conn = get_db_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT id, title, summary, created_at FROM sessions WHERE id = %s;", (session_id,))
        row = cursor.fetchone()
    conn.close()
    if row:
        return {
            "id": str(row["id"]),
            "title": row["title"],
            "summary": row["summary"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None
        }
    return None

def rename_session(session_id: str, new_title: str):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("UPDATE sessions SET title = %s WHERE id = %s;", (new_title, session_id))
        conn.commit()
    conn.close()

def delete_session(session_id: str):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("DELETE FROM sessions WHERE id = %s;", (session_id,))
        conn.commit()
    conn.close()

def save_message(message_id: str, session_id: str, role: str, content: str):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute(
            "INSERT INTO messages (id, session_id, role, content) VALUES (%s, %s, %s, %s) ON CONFLICT (id) DO NOTHING;",
            (message_id, session_id, role, content)
        )
        conn.commit()
    conn.close()

def get_session_messages(session_id: str):
    conn = get_db_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute(
            "SELECT id, session_id, role, content, created_at FROM messages WHERE session_id = %s ORDER BY created_at ASC;",
            (session_id,)
        )
        rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": str(row["id"]),
            "session_id": str(row["session_id"]),
            "role": row["role"],
            "content": row["content"],
            "created_at": row["created_at"].isoformat() if row["created_at"] else None
        }
        for row in rows
    ]

def update_session_summary(session_id: str, summary: str):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("UPDATE sessions SET summary = %s WHERE id = %s;", (summary, session_id))
        conn.commit()
    conn.close()

def mask_key(api_key: str):
    if not api_key:
        return ""
    if len(api_key) <= 8:
        return "configured"
    return f"{api_key[:4]}...{api_key[-4:]}"

def serialize_provider(row):
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "provider_type": row["provider_type"],
        "base_url": row["base_url"],
        "api_key_masked": mask_key(row["api_key"]),
        "model": row["model"],
        "is_active": row["is_active"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None
    }

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
    active = os.getenv("ACTIVE_PROVIDER", "ollama")
    conn = get_db_connection()
    with conn.cursor() as cursor:
        for item in defaults:
            cursor.execute(
                """
                INSERT INTO providers (id, name, provider_type, base_url, api_key, model, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO NOTHING;
                """,
                (
                    item["id"],
                    item["name"],
                    item["provider_type"],
                    item["base_url"],
                    item["api_key"],
                    item["model"],
                    item["provider_type"] in (active, "openai_compatible" if active == "groq" else active),
                )
            )
        cursor.execute("SELECT COUNT(*) FROM providers WHERE is_active = TRUE;")
        has_active = cursor.fetchone()[0] > 0
        if not has_active:
            cursor.execute(
                "UPDATE providers SET is_active = TRUE WHERE id = %s;",
                ("00000000-0000-0000-0000-000000000002",)
            )
        conn.commit()
    conn.close()

def get_providers(include_keys: bool = False):
    conn = get_db_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        cursor.execute("SELECT * FROM providers ORDER BY created_at ASC;")
        rows = cursor.fetchall()
    conn.close()
    if include_keys:
        return [dict(row) for row in rows]
    return [serialize_provider(row) for row in rows]

def get_provider_config(provider_id: str | None = None):
    conn = get_db_connection()
    with conn.cursor(cursor_factory=RealDictCursor) as cursor:
        if provider_id:
            cursor.execute("SELECT * FROM providers WHERE id = %s;", (provider_id,))
        else:
            cursor.execute("SELECT * FROM providers WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1;")
        row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def create_provider(provider_id: str, data: dict):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        if data.get("is_active"):
            cursor.execute("UPDATE providers SET is_active = FALSE;")
        cursor.execute(
            """
            INSERT INTO providers (id, name, provider_type, base_url, api_key, model, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s);
            """,
            (
                provider_id,
                data["name"],
                data["provider_type"],
                data.get("base_url", ""),
                data.get("api_key", ""),
                data["model"],
                data.get("is_active", False),
            )
        )
        conn.commit()
    conn.close()

def update_provider(provider_id: str, data: dict):
    existing = get_provider_config(provider_id)
    if not existing:
        return
    api_key = data.get("api_key")
    if api_key is None or api_key == "":
        api_key = existing.get("api_key", "")
    conn = get_db_connection()
    with conn.cursor() as cursor:
        if data.get("is_active"):
            cursor.execute("UPDATE providers SET is_active = FALSE;")
        cursor.execute(
            """
            UPDATE providers
            SET name = %s, provider_type = %s, base_url = %s, api_key = %s, model = %s, is_active = %s
            WHERE id = %s;
            """,
            (
                data["name"],
                data["provider_type"],
                data.get("base_url", ""),
                api_key,
                data["model"],
                data.get("is_active", existing.get("is_active", False)),
                provider_id,
            )
        )
        conn.commit()
    conn.close()

def delete_provider(provider_id: str):
    conn = get_db_connection()
    with conn.cursor() as cursor:
        cursor.execute("DELETE FROM providers WHERE id = %s;", (provider_id,))
        cursor.execute("SELECT COUNT(*) FROM providers WHERE is_active = TRUE;")
        has_active = cursor.fetchone()[0] > 0
        if not has_active:
            cursor.execute(
                "UPDATE providers SET is_active = TRUE WHERE id = (SELECT id FROM providers ORDER BY created_at ASC LIMIT 1);"
            )
        conn.commit()
    conn.close()
