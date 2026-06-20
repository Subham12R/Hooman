# Product Requirements Document — Hooman

## 1. Executive Summary

Hooman is a local-first desktop AI assistant that gives users full control over their LLM interactions. It supports multiple AI providers (Anthropic, Ollama, Groq, any OpenAI-compatible API), session-scoped RAG on uploaded documents, a web research agent, and deep-thinking mode — all within a native Electron desktop app. No data leaves your machine except the API calls you explicitly configure.

---

## 2. Goals & Non-Goals

### Goals

- Provide a fast, native chat interface for multiple LLM providers
- Enable document Q&A via upload (PDF, DOCX, TXT, MD, CSV) with session-scoped RAG
- Support web research via a multi-stage agent (plan → search → fetch → synthesize)
- Offer deep-thinking and planning modes with structured reasoning
- Keep conversations organized with folders, search, pinning, and renaming
- Store all conversation history and file indexes locally in SQLite
- Secure API key management via OS keychain
- Usage tracking per provider and model

### Non-Goals

- Not a cloud service — no multi-device sync, no accounts
- Not a replacement for a full IDE — no code execution sandbox
- No image generation or multimodal support
- No plugin/extension system
- No team collaboration

---

## 3. User Personas

### Persona A: Local-First User

- Runs Ollama locally with open-weight models
- Wants full privacy, no data sent to third parties
- Needs document Q&A without cloud uploads

### Persona B: Power User

- Subscribes to Anthropic/OpenAI for complex reasoning
- Uses web research agent for deep topic exploration
- Juggles multiple conversations, uses folders and search

### Persona C: Casual User

- Wants a ChatGPT-like desktop app
- Tries different providers to compare quality/cost
- Primarily uses chat mode, occasionally attaches files

---

## 4. Functional Requirements

### FR-1: Multi-Provider LLM Support

- Users can add, edit, and delete providers with any API-compatible endpoint
- Supported types: `anthropic`, `ollama`, `openai_compatible` (Groq, OpenRouter, Together, etc.)
- Each provider has name, type, base URL, API key (stored in OS keychain), model, and active toggle
- Exactly one provider can be active at a time
- A ModelSelector dropdown in the header allows quick switching

### FR-2: Chat Interface

- Real-time streaming responses via WebSocket
- Markdown rendering with GFM tables, code blocks, links, blockquotes, images
- Thinking steps display (Spinner component) with expandable step list
- Research trace visualization (ResearchTrace component) showing plan/search/fetch/synthesize stages
- Response duration display
- Scroll-to-bottom floating button when scrolled up

### FR-3: Three Interaction Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| Chat | No prefix | Standard LLM chat + optional RAG |
| Think | `[Think: ...]` button | Deep reasoning with tradeoff analysis |
| Search | `[Search: ...]` button | Web research agent |
| Plan | `[Plan: ...]` button | Same research agent |

- Mode toggle buttons in the input box with distinct visual styles (Search blue, Think purple, Plan orange)
- Active mode shows a colored glow border on the input

### FR-4: Document RAG

- Upload PDF, TXT, MD, DOCX, or CSV files (max 20 MB)
- Backend extracts text, chunks (~600 chars), and embeds using BGE-small-en-v1.5
- On subsequent chat messages, top-5 chunks by cosine similarity are injected as context
- RAG is session-scoped — documents uploaded to one session don't leak to others
- File type badges and indexing status shown in the input area

### FR-5: Research Agent

- Triggered by `[Search: ...]` or `[Plan: ...]` prefixes
- 4-stage pipeline:
  1. **Plan**: LLM generates 3-5 sub-queries
  2. **Search**: Concurrent Serper API calls
  3. **Fetch**: Concurrent URL fetching + BeautifulSoup parsing
  4. **Synthesize**: LLM produces structured report with citations
- Research trace emitted as WebSocket events for real-time UI updates
- Reports saved and auto-embedded for future RAG

### FR-6: Conversation Management

- Sidebar shows all sessions with search, filter (All/Active/Empty), and folder grouping
- Sessions can be renamed, pinned, deleted (single or bulk select), and assigned to folders
- Folder CRUD with inline rename and delete
- Long conversations handled via token-budget context window + background summarization
- Auto-scroll to bottom on new messages (unless user has scrolled up)

### FR-7: Provider Management

- CRUD interface for LLM providers
- API keys saved to OS keyring (not in database)
- Provider type determines available fields (API key hidden for Ollama)
- Active provider toggle

### FR-8: Settings

- User profile (name, email, avatar) auto-saved to backend
- Usage statistics per model/provider (requests, estimated tokens, last used)
- Provider base URL configuration guide

### FR-9: Theming

- Dark and light themes
- Persisted to localStorage
- All chat area colors sync with theme

---

## 5. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Startup time | < 2 seconds |
| Message latency | First token within 1 second (streaming) |
| RAG retrieval | < 500ms for 1000 chunks |
| File upload | < 3 seconds for 20 MB file |
| Research agent | Full pipeline within 30 seconds |
| Memory (idle) | < 200 MB (Electron) |
| Backend CPU | Single-core sufficient for 1 user |
| Database size | < 500 MB for 10K sessions |

---

## 6. User Interface

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Sidebar          │  Header (provider, actions)      │
│  ┌──────────┐     ├─────────────────────────────────┤
│  │ Hooman   │     │                                 │
│  │          │     │  Messages Area                  │
│  │ New Chat │     │  (scrollable, flex-1)           │
│  │ Chats    │     │                                 │
│  │Providers │     │                                 │
│  │ Settings │     │                                 │
│  │          │     │  ┌─[Scroll to Latest]─────────┐ │
│  │────────  │     │  └────────────────────────────┘ │
│  │ conv 1   │     ├─────────────────────────────────┤
│  │ conv 2   │     │  Input Box (mode toggles, send) │
│  │ conv 3   │     └─────────────────────────────────┘
│  │          │
│  ├──────────┤
│  │ User     │
└──┴──────────┘
```

### Key UI Components

- **Sidebar**: App branding, 4 nav items, collapsible conversation list, user footer
- **Header**: Sidebar hamburger, model selector, view-specific actions (filter, select, new chat)
- **Message bubbles**: User (right-aligned, filled) / Assistant (left-aligned, subtle bg), renders Markdown
- **Input box**: Textarea, file upload, mode toggles (Search/Think/Plan), send/stop/voice button
- **Spinner**: Expandable thinking steps with animated status dots
- **ResearchTrace**: Stage-by-stage visualization with expandable details

---

## 7. Future Considerations

- Multi-modal support (image understanding via Vision models)
- Persistent agent memory across sessions
- MCP (Model Context Protocol) tool integration
- Local embeddings database with vector index (FAISS/Annoy) for scale
- Conversation branching / version history
- Export chats as PDF/Markdown
- Token usage cost tracking with configurable budgets
- macOS/Linux native builds with auto-update
