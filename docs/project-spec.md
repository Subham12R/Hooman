# Project Specification — Hooman

> **Version**: 1.0.0  
> **Release**: June 2026  
> **License**: Proprietary

---

## 1. Project Structure

```
D:\Code\Hooman\
│
├── README.md                       # System overview, architecture, getting started
│
├── backend/                        # Python FastAPI server
│   ├── main.py                     # Entry point, REST routes, WebSocket handler, generation loop
│   ├── database.py                 # SQLite schema, migrations, all CRUD operations
│   ├── embedder.py                 # BGE-small-en-v1.5 embedding + cosine similarity
│   ├── file_processor.py           # File text extraction + chunking
│   ├── research_agent.py           # Web research agent (plan → search → fetch → synthesize)
│   ├── context_manager.py          # Token budget + overflow summarization
│   ├── providers/
│   │   ├── __init__.py
│   │   ├── base.py                 # Abstract BaseProvider
│   │   ├── anthropic_provider.py   # Claude streaming via Anthropic SDK
│   │   ├── openai_compatible.py    # OpenAI-compatible streaming (Ollama, Groq, etc.)
│   │   └── registry.py             # Provider resolution factory
│   ├── .env                        # Environment configuration
│   ├── requirements.txt            # Python dependencies
│   └── hooman.db                   # SQLite database (auto-created)
│
├── electron-app/                   # Electron desktop client
│   ├── electron.vite.config.ts     # Build configuration
│   ├── package.json                # Node dependencies
│   ├── electron-builder.yml        # Packaging config
│   ├── resources/                  # App icons
│   └── src/
│       ├── main/
│       │   └── index.ts            # Electron main process (BrowserWindow, IPC)
│       ├── preload/
│       │   ├── index.ts            # Context bridge (electronAPI + api)
│       │   └── index.d.ts          # Type declarations
│       └── renderer/
│           ├── index.html          # HTML shell
│           └── src/
│               ├── main.tsx        # React entry point
│               ├── App.tsx         # Main app component, WebSocket, state, views
│               ├── env.d.ts        # Vite client type declarations
│               ├── assets/
│               │   ├── main.css    # Tailwind v4 + theme CSS variables
│               │   ├── fonts/Helvetica.ttf
│               │   └── images/logo.png
│               ├── hooks/
│               │   ├── use-theme.tsx   # Dark/light theme with localStorage persistence
│               │   └── use-mobile.tsx  # Mobile breakpoint detection
│               ├── lib/
│               │   └── utils.ts    # cn() utility (clsx + tailwind-merge)
│               └── components/
│                   ├── app-sidebar.tsx      # Main sidebar with nav + session list
│                   ├── model-selector.tsx   # Provider dropdown
│                   ├── spinner.tsx           # Thinking steps animation
│                   ├── research-trace.tsx    # Research workflow visualization
│                   ├── settings-view.tsx     # Settings page
│                   └── ui/                  # shadcn/ui primitives
│                       ├── sidebar.tsx, dropdown-menu.tsx, tooltip.tsx
│                       ├── button.tsx, input.tsx, avatar.tsx
│                       ├── separator.tsx, sheet.tsx, skeleton.tsx
│                       ├── collapsible.tsx, breadcrumb.tsx
│                       └── ai-prompt-box.tsx  # Rich input box (962 lines)
│
└── docs/                           # Documentation
    ├── PRD.md                      # Product requirements
    ├── tech-stack.md               # Technology choices and rationale
    └── project-spec.md             # This file
```

---

## 2. Database Schema

**Engine**: SQLite with WAL mode, foreign keys enabled

### Tables

#### `sessions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID |
| `title` | `TEXT NOT NULL` | Display name, set from first message |
| `summary` | `TEXT DEFAULT ''` | Rolling summary from overflow context |
| `pinned` | `INTEGER DEFAULT 0` | 0 or 1 |
| `folder_id` | `TEXT` | FK to `folders.id`, nullable |
| `created_at` | `TEXT` | ISO datetime |

#### `messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID |
| `session_id` | `TEXT NOT NULL` | FK → `sessions.id` ON DELETE CASCADE |
| `role` | `TEXT NOT NULL` | `user` or `assistant` |
| `content` | `TEXT NOT NULL` | Full message content |
| `created_at` | `TEXT` | ISO datetime |

#### `providers`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID |
| `name` | `TEXT NOT NULL` | Display name |
| `provider_type` | `TEXT NOT NULL` | `anthropic` / `ollama` / `openai_compatible` |
| `base_url` | `TEXT DEFAULT ''` | API endpoint |
| `api_key` | `TEXT DEFAULT ''` | Blinded (stored in OS keyring) |
| `model` | `TEXT NOT NULL` | Model identifier |
| `is_active` | `INTEGER DEFAULT 0` | 0 or 1 |
| `created_at` | `TEXT` | ISO datetime |

#### `chunks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID |
| `session_id` | `TEXT NOT NULL` | FK → `sessions.id` |
| `content` | `TEXT NOT NULL` | Text chunk |
| `embedding` | `BLOB` | float32 numpy array, 384-dim |
| `source` | `TEXT DEFAULT ''` | Original filename |
| `created_at` | `TEXT` | ISO datetime |

#### `folders`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID |
| `name` | `TEXT NOT NULL` | Folder display name |
| `position` | `INTEGER DEFAULT 0` | Sort order |
| `created_at` | `TEXT` | ISO datetime |

#### `user_settings`
| Column | Type | Notes |
|--------|------|-------|
| `key` | `TEXT PK` | Setting name |
| `value` | `TEXT NOT NULL` | Setting value |

#### `usage_log`
| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PK` | UUID |
| `session_id` | `TEXT` | FK → `sessions.id`, nullable |
| `model` | `TEXT NOT NULL` | Model name |
| `provider_type` | `TEXT NOT NULL` | Provider type |
| `input_chars` | `INTEGER DEFAULT 0` | Input character count |
| `output_chars` | `INTEGER DEFAULT 0` | Output character count |
| `created_at` | `TEXT` | ISO datetime |

---

## 3. API Specification

### REST Endpoints

All REST endpoints are prefixed with `/api` unless noted.

#### Sessions
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/sessions` | — | Array of sessions with `message_count`, `last_message_at`, `pinned`, `folder_id` |
| `POST` | `/api/sessions` | `{ id, title }` | Created session |
| `PUT` | `/api/sessions/{id}` | `{ title }` | Updated session |
| `DELETE` | `/api/sessions/{id}` | — | 200 OK |
| `GET` | `/api/sessions/{id}/messages` | — | Array of messages ordered by `created_at` |
| `PUT` | `/api/sessions/{id}/pin` | — | `{ pinned: bool }` |
| `PUT` | `/api/sessions/{id}/folder` | `{ folder_id: string\|null }` | Updated session |
| `POST` | `/api/sessions/{id}/upload` | `multipart file` | `{ chunks, filename }` |
| `GET` | `/api/sessions/{id}/files` | — | Array of distinct source filenames |

#### Folders
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/folders` | — | Array of folders |
| `POST` | `/api/folders` | `{ name }` | `{ id, name, position }` |
| `PUT` | `/api/folders/{id}` | `{ name }` | Updated folder |
| `DELETE` | `/api/folders/{id}` | — | 200 OK |

#### Providers
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/providers` | — | Array of providers (keys masked) |
| `POST` | `/api/providers` | `{ name, provider_type, model, base_url, api_key, is_active }` | Created provider |
| `PUT` | `/api/providers/{id}` | Partial provider fields | Updated provider |
| `DELETE` | `/api/providers/{id}` | — | 200 OK (reassigns active if needed) |

#### Settings & Stats
| Method | Path | Request | Response |
|--------|------|---------|----------|
| `GET` | `/api/settings/user` | — | `{ name, email, avatar }` |
| `PUT` | `/api/settings/user` | `{ name?, email?, avatar? }` | Updated settings |
| `GET` | `/api/stats/usage` | — | `{ total_requests, total_input_chars, total_output_chars, by_model: [...] }` |

#### Health
| Method | Path | Response |
|--------|------|----------|
| `GET` | `/health` | `{ status: "ok" }` |

### WebSocket

**Endpoint**: `ws://localhost:8000/ws/chat`

**Client → Server**:
```json
{ "type": "chat", "text": "...", "session_id": "...", "request_id": "...", "provider_id": "...", "model": "..." }
{ "type": "stop", "request_id": "..." }
```

**Server → Client**:
```json
{ "type": "accepted", "session_id": "...", "request_id": "...", "mode": "chat|think|research" }
{ "type": "workflow", "session_id": "...", "request_id": "...", "steps": [{"id":"...", "text":"...", "status":"running"}] }
{ "type": "trace", "stage": "plan|search|fetch|synthesize", "status": "running|completed", "data": {...} }
{ "type": "delta", "session_id": "...", "request_id": "...", "text": "..." }
{ "type": "done", "session_id": "...", "request_id": "...", "steps": [...] }
{ "type": "stopped", "session_id": "...", "request_id": "..." }
{ "type": "error", "session_id": "...", "request_id": "...", "message": "..." }
```

---

## 4. Key Configuration

### Environment Variables (`backend/.env`)

```
PORT=8000
CORS_ORIGINS=http://localhost:5173
ACTIVE_PROVIDER=ollama

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

GROQ_API_KEY=...
GROQ_MODEL=llama-3.3-70b-versatile

OLLAMA_BASE_URL=http://localhost:11434/v1
OLLAMA_MODEL=qwen3:14b

SERPER_API_KEY=...
```

### Frontend Config (`electron-app/.env`)

```
VITE_BACKEND_HTTP_URL=http://localhost:8000
VITE_BACKEND_WS_URL=ws://localhost:8000/ws/chat
```

---

## 5. Key Algorithms

### Mode Detection

```
Input text                    → Detected Mode
"[Search: what is X]"         → research (query: "what is X")
"[Plan: research Y]"          → research (query: "research Y")
"[Think: solve Z]"            → think    (query: "solve Z")
"Hello world"                 → chat     (query: "Hello world")
```

### Context Assembly

1. Fetch all messages for session, ordered by `created_at` ASC
2. Estimate tokens: `len(text) // 4`
3. Traverse newest-first within 6000 token budget → `active_messages`
4. Remaining → `overflow_messages`
5. Inject `sessions.summary` into system prompt
6. After generation: asynchronously summarize overflow + existing summary

### RAG Retrieval

1. Embed user's message text with `BGE-small-en-v1.5` → 384-dim vector
2. Fetch all chunks for the current session from DB
3. Compute cosine similarity against each chunk's stored embedding
4. Return top-5 chunks by similarity score
5. Prepend to system prompt as `Relevant context from this session:`

### WebSocket Auto-Reconnect

Frontend attempts reconnection every 1.2 seconds after WebSocket closes. On reconnect, session state is preserved (no re-send of last message needed).

---

## 6. Security

- **API keys**: Stored in OS keychain via `keyring` library, never logged or exposed in API responses
- **CORS**: Backend accepts requests from `http://localhost:5173` (Vite dev) and Electron file protocol
- **CSP**: Content-Security-Policy restricts `connect-src` to `self`, `localhost:8000` only
- **Local storage**: Database, uploaded files, and settings all stay on the user's machine
- **No telemetry**: Zero analytics, crash reports, or network calls beyond configured APIs

---

## 7. Known Limitations

- Embedding search is brute-force O(n) over session chunks — no vector index
- Single database file — no replication or backup strategy
- WebSocket reconnection doesn't replay in-flight messages
- No token counting for LLM context limits (uses rough character-based estimate)
- Research agent depends on Serper API (requires API key)
- Backend runs as a single process — no worker scaling
- File storage is in-memory during upload, not persisted to disk independently of DB
