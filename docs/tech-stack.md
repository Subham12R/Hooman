# Tech Stack — Hooman

## Overview

```
┌──────────────────────────────────────────────────────────┐
│                    ELECTRON SHELL                         │
│  ┌────────────────────────────────────────────────────┐  │
│  │              REACT 19 + TYPESCRIPT                  │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ shadcn/ui│  │ Tailwind │  │  Framer Motion   │  │  │
│  │  │  + Radix │  │   v4     │  │  (animations)    │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │        WebSocket (auto-reconnect)              │  │  │
│  │  │        fetch API (REST)                        │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
│                           │                               │
│                   HTTP / WebSocket                        │
│                           │                               │
│  ┌────────────────────────────────────────────────────┐  │
│  │              FASTAPI + UVICORN                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │  │
│  │  │ SQLite   │  │ fastembed│  │  LLM Providers   │  │  │
│  │  │ (WAL)    │  │  BGE-v1.5│  │  Anthropic SDK   │  │  │
│  │  │          │  │  384-dim │  │  OpenAI SDK      │  │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │  Research Agent: httpx + BeautifulSoup + Serper│  │  │
│  │  │  File Processor: pypdf + python-docx            │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Frontend

### Core

| Technology | Version | Purpose |
|------------|---------|---------|
| Electron | 35 | Desktop shell |
| React | 19 | UI framework |
| TypeScript | 5.7 | Type safety |
| Vite | 6 | Bundler + HMR |
| electron-vite | 2 | Electron + Vite integration |

### UI & Styling

| Technology | Purpose |
|------------|---------|
| Tailwind CSS v4 | Utility-first styling with `@theme` directives and `@custom-variant dark` |
| shadcn/ui | Primitive component library (sidebar, dropdown, tooltip, avatar, button, etc.) |
| Radix UI | Accessible headless primitives underpinning shadcn components |
| Framer Motion | Research trace stage animations |
| Lucide React | Icon set (ChevronDown, Trash2, Plus, Search, etc.) |
| @hugeicons/react | Alternate icon set (Add01Icon, BubbleChatIcon, etc.) |
| @theme-toggles/react | Theme toggle component (Simple) |
| sonner | Toast notification library |

### State & Data Flow

| Technology | Purpose |
|------------|---------|
| React useState/useRef | All state management — no external state library |
| React Context | Theme provider scoped to app root |
| WebSocket API (native) | Real-time streaming chat messages |
| fetch API (native) | REST calls for sessions, providers, folders, settings |

### Build & Quality

| Tool | Purpose |
|------|---------|
| electron-vite | Build pipeline (main/preload/renderer) |
| ESLint + Prettier | Code quality and formatting |
| electron-builder | Packaging for Win/Mac/Linux |

---

## Backend

### Core

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.10+ | Runtime |
| FastAPI | latest | REST + WebSocket framework |
| Uvicorn | latest | ASGI server |

### AI & Embeddings

| Technology | Purpose |
|------------|---------|
| anthropic SDK | Claude model streaming |
| openai SDK | Ollama, Groq, OpenRouter, Together streaming |
| fastembed | ONNX-optimized embedding inference |
| BAAI/bge-small-en-v1.5 | Embedding model (384-dim, ~130 MB) |

### Database & Storage

| Technology | Purpose |
|------------|---------|
| SQLite (via sqlite3) | Local database with WAL mode |
| keyring | OS keychain for API key storage |

### Research Agent

| Technology | Purpose |
|------------|---------|
| httpx | Async HTTP client for web scraping |
| BeautifulSoup 4 | HTML parsing and text extraction |
| Serper API | Google Search API |

### File Processing

| Technology | Purpose |
|------------|---------|
| pypdf | PDF text extraction |
| python-docx | DOCX text extraction |
| python-multipart | File upload handling |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| python-dotenv | Environment variable loading |
| numpy | Vector operations for cosine similarity |
| asyncio | Concurrent web searches and URL fetches |

---

## Data Flow Summary

```
[User Input]
    │
    ▼
[PromptInputBox] ── mode detection ──► [WebSocket JSON]
    │                                            │
    │                                            ▼
    │                              [FastAPI /ws/chat]
    │                                   │
    │                                   ├── parse_mode()
    │                                   ├── build_context()
    │                                   ├── RAG retrieval (if files exist)
    │                                   ├── resolve_provider()
    │                                   │
    │                                   ├── chat/think → direct LLM call
    │                                   └── research  → research_agent.py
    │                                                    ├── Plan (LLM)
    │                                                    ├── Search (Serper)
    │                                                    ├── Fetch (httpx+BS4)
    │                                                    └── Synthesize (LLM)
    │                                   │
    │                                   └── WebSocket events (workflow, trace, delta, done)
    │                                            │
    ▼                                            ▼
[React re-renders] ◄────── [WebSocket onmessage]
    │
    ├── Spinner (steps)
    ├── ResearchTrace (traces)
    └── Markdown (streaming text)
```

---

## Why These Choices

| Decision | Rationale |
|----------|-----------|
| **Electron** over Tauri | Python backend needs a sidecar; Electron's ecosystem and IPC are well-suited |
| **No state library** | App is single-user with linear state; React's built-in hooks keep complexity low |
| **SQLite** over Postgres | Zero-config, file-based, perfect for single-user desktop app |
| **BGE-small-en-v1.5** over OpenAI embeddings | Runs locally, no API cost, fast inference via ONNX |
| **Brute-force cosine** over vector DB | Session-scoped retrieval means at most ~200 chunks; no need for FAISS |
| **fastembed** over sentence-transformers | ONNX-optimized, lightweight, no PyTorch dependency |
| **Serper API** over custom search | Reliable, cheap, structured results; avoids building a web crawler |
| **FastAPI** over Flask | Native async (critical for WebSocket and concurrent search), built-in OpenAPI docs |
