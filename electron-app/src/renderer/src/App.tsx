import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { ModelSelector, type ProviderOption } from '@/components/model-selector'
import { PromptInputBox } from '@/components/ui/ai-prompt-box'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Spinner, type ThinkingStep } from '@renderer/components/spinner'
import { Check, ChevronDown, PenBox, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { HugeiconsIcon } from '@hugeicons/core-free-icons';

type Message = {
  from: 'user' | 'assistant'
  text: string
  rawText?: string
  requestId?: string
  streaming?: boolean
  stopped?: boolean
  steps?: ThinkingStep[]
}

type Session = {
  id: string
  title: string
  created_at?: string
  last_message_at?: string
  message_count?: number
  summary?: string
}

type Provider = ProviderOption & {
  base_url: string
  api_key_masked: string
  created_at?: string
}

type DbMessage = {
  role: 'user' | 'assistant'
  content: string
}

const WS_URL = import.meta.env.VITE_BACKEND_WS_URL as string
const HTTP_URL = (import.meta.env.VITE_BACKEND_HTTP_URL as string) || 'http://localhost:8000'

const emptyProviderForm = {
  id: '',
  name: '',
  provider_type: 'ollama',
  model: '',
  base_url: '',
  api_key: '',
  is_active: false,
}

function formatRelativeTime(isoString?: string): string {
  if (!isoString) return 'No activity'
  const date = new Date(isoString)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin} min ago`
  if (diffHour < 24) return `${diffHour} hr ago`
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function parseDbMessage(msg: DbMessage): Message {
  return {
    from: msg.role,
    text: msg.content,
    rawText: msg.content,
    streaming: false,
  }
}

function renderMessageText(text: string): ReactNode[] {
  return text
    .split(/\n{2,}/)
    .filter((part) => part.trim().length > 0)
    .map((part, index) => (
      <p key={index} className="mb-3 last:mb-0 whitespace-pre-wrap break-words">
        {part.trim()}
      </p>
    ))
}

function upsertAssistantMessage(messages: Message[], requestId: string, patch: Partial<Message>): Message[] {
  const existingIndex = messages.findIndex((msg) => msg.from === 'assistant' && msg.requestId === requestId)
  if (existingIndex === -1) {
    return [
      ...messages,
      {
        from: 'assistant',
        text: '',
        rawText: '',
        requestId,
        streaming: true,
        ...patch,
      },
    ]
  }

  const next = [...messages]
  next[existingIndex] = { ...next[existingIndex], ...patch }
  return next
}

function App(): ReactNode {
  const [messages, setMessages] = useState<Message[]>([])
  const [messagesCache, setMessagesCache] = useState<Record<string, Message[]>>({})
  const [sessions, setSessions] = useState<Session[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'chat' | 'chats-list' | 'providers'>('chat')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [filterMode, setFilterMode] = useState<'All' | 'Active' | 'Empty'>('All')
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false)
  const [providerForm, setProviderForm] = useState(emptyProviderForm)
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentSessionIdRef = useRef<string | null>(null)
  const activeRequestIdRef = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const filterRef = useRef<HTMLDivElement>(null)

  const selectedProvider = providers.find((provider) => provider.id === selectedProviderId) ?? providers[0]

  async function fetchSessions(autoSelectFirst = false): Promise<void> {
    try {
      const res = await fetch(`${HTTP_URL}/api/sessions`)
      const data = await res.json()
      if (!Array.isArray(data)) return
      setSessions(data)
      if (autoSelectFirst && data.length > 0 && !currentSessionIdRef.current) {
        await handleSelectSession(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching sessions:', error)
    }
  }

  async function fetchProviders(): Promise<void> {
    try {
      const res = await fetch(`${HTTP_URL}/api/providers`)
      const data = await res.json()
      if (!Array.isArray(data)) return
      setProviders(data)
      const active = data.find((provider: Provider) => provider.is_active) ?? data[0]
      if (active && !selectedProviderId) setSelectedProviderId(active.id)
    } catch (error) {
      console.error('Error fetching providers:', error)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProviders()
    fetchSessions(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent): void {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!WS_URL) return
    let cancelled = false

    function connect(): void {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onmessage = (event) => {
        if (cancelled) return
        const data = JSON.parse(event.data)
        const targetId = data.session_id || currentSessionIdRef.current
        const requestId = data.request_id || activeRequestIdRef.current
        if (!targetId || !requestId) return

        if (data.type === 'accepted') {
          currentSessionIdRef.current = targetId
          setCurrentSessionId(targetId)
          fetchSessions(false)
          return
        }

        if (data.type === 'workflow') {
          updateAssistant(targetId, requestId, { steps: data.steps, streaming: true })
          return
        }

        if (data.type === 'delta') {
          setIsLoading(false)
          setMessagesCache((cache) => {
            const prev = cache[targetId] || []
            const current = prev.find((msg) => msg.from === 'assistant' && msg.requestId === requestId)
            const rawText = `${current?.rawText || ''}${data.text}`
            const nextMessages = upsertAssistantMessage(prev, requestId, {
              text: rawText,
              rawText,
              streaming: true,
            })
            if (targetId === currentSessionIdRef.current) setMessages(nextMessages)
            return { ...cache, [targetId]: nextMessages }
          })
          return
        }

        if (data.type === 'done') {
          finishAssistant(targetId, requestId, false, data.steps)
          fetchSessions(false)
          return
        }

        if (data.type === 'stopped') {
          finishAssistant(targetId, requestId, true)
          return
        }

        if (data.type === 'error') {
          setIsLoading(false)
          updateAssistant(targetId, requestId, {
            text: `Error: ${data.message}`,
            rawText: `Error: ${data.message}`,
            streaming: false,
          })
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        reconnectTimerRef.current = setTimeout(connect, 1200)
      }

      ws.onerror = () => {
        if (cancelled) return
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  function updateAssistant(sessionId: string, requestId: string, patch: Partial<Message>): void {
    setMessagesCache((cache) => {
      const prev = cache[sessionId] || []
      const nextMessages = upsertAssistantMessage(prev, requestId, patch)
      if (sessionId === currentSessionIdRef.current) setMessages(nextMessages)
      return { ...cache, [sessionId]: nextMessages }
    })
  }

  function finishAssistant(sessionId: string, requestId: string, stopped: boolean, steps?: ThinkingStep[]): void {
    setIsLoading(false)
    if (activeRequestIdRef.current === requestId) activeRequestIdRef.current = null
    setMessagesCache((cache) => {
      const prev = cache[sessionId] || []
      const existing = prev.find((msg) => msg.from === 'assistant' && msg.requestId === requestId)
      const text = stopped && !existing?.text ? 'Stopped.' : existing?.text || ''
      const nextMessages = upsertAssistantMessage(prev, requestId, {
        text,
        rawText: text,
        streaming: false,
        stopped,
        steps: steps ?? existing?.steps,
      })
      if (sessionId === currentSessionIdRef.current) setMessages(nextMessages)
      return { ...cache, [sessionId]: nextMessages }
    })
  }

  async function handleSelectSession(sessionId: string): Promise<void> {
    setActiveView('chat')
    currentSessionIdRef.current = sessionId
    setCurrentSessionId(sessionId)

    const cached = messagesCache[sessionId]
    if (cached) {
      setMessages(cached)
      setIsLoading(cached.some((msg) => msg.streaming))
    }

    try {
      const res = await fetch(`${HTTP_URL}/api/sessions/${sessionId}/messages`)
      const data = await res.json()
      if (!Array.isArray(data)) return
      const fetched = data.map(parseDbMessage)
      setMessagesCache((cache) => ({ ...cache, [sessionId]: fetched }))
      if (currentSessionIdRef.current === sessionId) {
        setMessages(fetched)
        setIsLoading(false)
      }
    } catch (error) {
      console.error('Error loading session messages:', error)
      setIsLoading(false)
    }
  }

  async function handleCreateSession(): Promise<void> {
    const newId = crypto.randomUUID()
    const newSession = { id: newId, title: 'New Chat', message_count: 0 }
    setSessions((prev) => [newSession, ...prev])
    setMessagesCache((prev) => ({ ...prev, [newId]: [] }))
    currentSessionIdRef.current = newId
    setCurrentSessionId(newId)
    setMessages([])
    setIsLoading(false)
    setActiveView('chat')

    try {
      await fetch(`${HTTP_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: newId, title: 'New Chat' }),
      })
      fetchSessions(false)
    } catch (error) {
      console.error('Error creating session:', error)
    }
  }

  async function handleRenameSession(sessionId: string, newTitle: string): Promise<void> {
    const title = newTitle.trim()
    if (!title) return
    setSessions((prev) => prev.map((session) => (session.id === sessionId ? { ...session, title } : session)))
    await fetch(`${HTTP_URL}/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    })
    fetchSessions(false)
  }

  async function handleDeleteSession(sessionId: string): Promise<void> {
    setSessions((prev) => prev.filter((session) => session.id !== sessionId))
    setMessagesCache((prev) => {
      const next = { ...prev }
      delete next[sessionId]
      return next
    })
    if (currentSessionIdRef.current === sessionId) {
      currentSessionIdRef.current = null
      setCurrentSessionId(null)
      setMessages([])
    }
    await fetch(`${HTTP_URL}/api/sessions/${sessionId}`, { method: 'DELETE' })
    fetchSessions(false)
  }

  async function handleDeleteSelected(): Promise<void> {
    const ids = Array.from(selectedSessions)
    if (ids.length === 0) return
    await Promise.all(ids.map((id) => handleDeleteSession(id)))
    setSelectedSessions(new Set())
    setIsSelectionMode(false)
  }

  function handleSend(text: string): void {
    const trimmed = text.trim()
    if (!trimmed || !selectedProvider) return

    const sessionId = currentSessionIdRef.current || crypto.randomUUID()
    const requestId = crypto.randomUUID()
    activeRequestIdRef.current = requestId
    currentSessionIdRef.current = sessionId
    setCurrentSessionId(sessionId)
    setIsLoading(true)

    const userMessage: Message = { from: 'user', text: trimmed }
    const assistantMessage: Message = {
      from: 'assistant',
      text: '',
      rawText: '',
      requestId,
      streaming: true,
      steps: [{ id: 'queued', text: 'Queued request', status: 'running' }],
    }
    const nextMessages = [...messages, userMessage, assistantMessage]
    setMessages(nextMessages)
    setMessagesCache((cache) => ({ ...cache, [sessionId]: nextMessages }))

    if (!currentSessionId) {
      fetch(`${HTTP_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: sessionId, title: trimmed.slice(0, 40) || 'New Chat' }),
      }).then(() => fetchSessions(false))
    }

    const activeSession = sessions.find((session) => session.id === sessionId)
    if (activeSession?.title === 'New Chat') {
      handleRenameSession(sessionId, trimmed.slice(0, 40))
    }

    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      updateAssistant(sessionId, requestId, {
        text: 'Try again in a moment.',
        streaming: false,
      })
      setIsLoading(false)
      return
    }

    wsRef.current.send(
      JSON.stringify({
        type: 'chat',
        text: trimmed,
        session_id: sessionId,
        request_id: requestId,
        provider_id: selectedProvider.id,
        model: selectedProvider.model,
      }),
    )
  }

  function handleStop(): void {
    const requestId = activeRequestIdRef.current
    if (!requestId || wsRef.current?.readyState !== WebSocket.OPEN) {
      setIsLoading(false)
      return
    }
    wsRef.current.send(JSON.stringify({ type: 'stop', request_id: requestId }))
  }

  function toggleSessionSelection(id: string): void {
    setSelectedSessions((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function startProviderEdit(provider: Provider): void {
    setEditingProviderId(provider.id)
    setProviderForm({
      id: provider.id,
      name: provider.name,
      provider_type: provider.provider_type,
      model: provider.model,
      base_url: provider.base_url || '',
      api_key: '',
      is_active: provider.is_active,
    })
  }

  async function saveProvider(): Promise<void> {
    if (!providerForm.name.trim() || !providerForm.model.trim()) return
    const method = editingProviderId ? 'PUT' : 'POST'
    const url = editingProviderId
      ? `${HTTP_URL}/api/providers/${editingProviderId}`
      : `${HTTP_URL}/api/providers`

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(providerForm),
    })
    setProviderForm(emptyProviderForm)
    setEditingProviderId(null)
    await fetchProviders()
  }

  async function removeProvider(providerId: string): Promise<void> {
    await fetch(`${HTTP_URL}/api/providers/${providerId}`, { method: 'DELETE' })
    await fetchProviders()
  }

  const streamingSessionIds = useMemo(
    () =>
      Object.entries(messagesCache)
        .filter(([, msgs]) => msgs.some((msg) => msg.streaming))
        .map(([id]) => id),
    [messagesCache],
  )

  const filteredSessions = sessions.filter((session) => {
    const query = searchQuery.toLowerCase()
    const matchesSearch = session.title.toLowerCase().includes(query) || session.summary?.toLowerCase().includes(query)
    if (!matchesSearch) return false
    if (filterMode === 'Active') return (session.message_count || 0) > 0
    if (filterMode === 'Empty') return (session.message_count || 0) === 0
    return true
  })

  const isEmpty = messages.length === 0

  return (
    <SidebarProvider className="bg-[#171717] text-zinc-100">
      <AppSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        activeView={activeView}
        streamingSessionIds={streamingSessionIds}
        onSelectSession={handleSelectSession}
        onCreateSession={handleCreateSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        onShowChatsList={() => {
          setActiveView('chats-list')
          setIsSelectionMode(false)
          setSelectedSessions(new Set())
        }}
        onShowProviders={() => setActiveView('providers')}
      />

      <SidebarInset className="bg-[#171717] text-zinc-100 h-screen overflow-hidden flex flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between px-4 bg-[#171717]/10 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <SidebarTrigger />
            <ModelSelector providers={providers} value={selectedProviderId} onChange={setSelectedProviderId} />
          </div>
          <button
            onClick={() => setActiveView('providers')}
            className="text-xs text-zinc-500 hover:text-zinc-200 font-helvetica tracking-tighter transition-colors"
          >
            <PenBox className="w-4 h-4 mr-1 inline-block" />
          </button>
        </header>

        {activeView === 'providers' ? (
          <ProvidersView
            providers={providers}
            providerForm={providerForm}
            editingProviderId={editingProviderId}
            onFormChange={setProviderForm}
            onSave={saveProvider}
            onCancel={() => {
              setProviderForm(emptyProviderForm)
              setEditingProviderId(null)
            }}
            onEdit={startProviderEdit}
            onDelete={removeProvider}
          />
        ) : activeView === 'chats-list' ? (
          <ChatsView
            filteredSessions={filteredSessions}
            selectedSessions={selectedSessions}
            isSelectionMode={isSelectionMode}
            filterMode={filterMode}
            filterDropdownOpen={filterDropdownOpen}
            filterRef={filterRef}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onFilterModeChange={setFilterMode}
            onFilterDropdownChange={setFilterDropdownOpen}
            onSelectionModeChange={setIsSelectionMode}
            onDeleteSelected={handleDeleteSelected}
            onCreateSession={handleCreateSession}
            onSelectSession={handleSelectSession}
            onToggleSessionSelection={toggleSessionSelection}
            onRenameSession={handleRenameSession}
            onDeleteSession={handleDeleteSession}
          />
        ) : isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
            <p className="font-helvetica text-2xl tracking-tighter text-zinc-300">What can I do for you?</p>
            <div className="w-full max-w-2xl">
              <PromptInputBox
                onSend={handleSend}
                placeholder={selectedProvider ? 'Message Hooman...' : 'Add a provider first...'}
                isLoading={isLoading}
                onStop={handleStop}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col overflow-y-auto no-scrollbar gap-3 px-4 py-4 mx-auto w-full max-w-2xl">
              {messages.map((msg, index) => {
                const isAssistant = msg.from === 'assistant'
                return (
                  <div
                    key={`${msg.requestId || index}-${msg.from}`}
                    className={`max-w-xl rounded-xl px-4 py-2.5 text-sm leading-relaxed font-helvetica ${
                      msg.from === 'user' ? 'ml-auto text-zinc-100 bg-zinc-900/30' : 'text-zinc-300'
                    }`}
                  >
                    {isAssistant && msg.steps && (
                      <div className="mb-1 pb-2">
                        <Spinner steps={msg.steps} isCollapsedByDefault={!msg.streaming} />
                      </div>
                    )}
                    {msg.text ? (
                      <div className="space-y-0">{renderMessageText(msg.text)}</div>
                    ) : (
                      <span className="text-xs text-zinc-600">Waiting for response...</span>
                    )}
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 px-4 pb-4">
              <div className="mx-auto w-full max-w-2xl">
                <PromptInputBox
                  onSend={handleSend}
                  placeholder={selectedProvider ? 'Message Hooman...' : 'Add a provider first...'}
                  isLoading={isLoading}
                  onStop={handleStop}
                />
              </div>
            </div>
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

function ChatsView({
  filteredSessions,
  selectedSessions,
  isSelectionMode,
  filterMode,
  filterDropdownOpen,
  filterRef,
  searchQuery,
  onSearchChange,
  onFilterModeChange,
  onFilterDropdownChange,
  onSelectionModeChange,
  onDeleteSelected,
  onCreateSession,
  onSelectSession,
  onToggleSessionSelection,
  onRenameSession,
  onDeleteSession,
}: {
  filteredSessions: Session[]
  selectedSessions: Set<string>
  isSelectionMode: boolean
  filterMode: 'All' | 'Active' | 'Empty'
  filterDropdownOpen: boolean
  filterRef: RefObject<HTMLDivElement | null>
  searchQuery: string
  onSearchChange: (value: string) => void
  onFilterModeChange: (value: 'All' | 'Active' | 'Empty') => void
  onFilterDropdownChange: (value: boolean) => void
  onSelectionModeChange: (value: boolean) => void
  onDeleteSelected: () => void
  onCreateSession: () => void
  onSelectSession: (id: string) => void
  onToggleSessionSelection: (id: string) => void
  onRenameSession: (id: string, title: string) => void
  onDeleteSession: (id: string) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar py-8 px-6 mx-auto w-full max-w-5xl flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-helvetica tracking-tighter text-zinc-100">Chats</h1>
          <p className="text-sm text-zinc-500 font-helvetica tracking-tighter mt-1">
            Search, organize, rename, and remove sessions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => onFilterDropdownChange(!filterDropdownOpen)}
              className="flex items-center gap-1.5 bg-[#1e1e1e] border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-300 hover:text-zinc-100 hover:border-zinc-700 transition-colors font-helvetica tracking-tighter"
            >
              <span>{filterMode}</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {filterDropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-32 rounded-lg bg-[#171717] border border-zinc-800 shadow-2xl z-50 p-1">
                {(['All', 'Active', 'Empty'] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      onFilterModeChange(option)
                      onFilterDropdownChange(false)
                    }}
                    className={`w-full text-left px-3 py-2 text-xs rounded-md transition-colors ${
                      filterMode === option ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isSelectionMode ? (
            <>
              <button
                onClick={onDeleteSelected}
                disabled={selectedSessions.size === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-950/60 text-red-200 border border-red-900/60 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete ({selectedSessions.size})
              </button>
              <button
                onClick={() => onSelectionModeChange(false)}
                className="px-4 py-2 text-xs rounded-lg border border-zinc-800 text-zinc-300 hover:text-zinc-100"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => onSelectionModeChange(true)}
              className="px-4 py-2 text-xs rounded-lg border border-zinc-800 text-zinc-300 hover:text-zinc-100"
            >
              Select
            </button>
          )}
          <button
            onClick={onCreateSession}
            className="flex items-center gap-1.5 bg-zinc-100 text-zinc-900 hover:bg-zinc-200 rounded-lg px-4 py-2 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            New chat
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by title or summary"
          className="w-full bg-[#1b1b1b]/80 border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-700 font-helvetica tracking-tighter"
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredSessions.length === 0 ? (
          <div className="md:col-span-2 py-12 text-center text-zinc-500 text-sm">No chats found</div>
        ) : (
          filteredSessions.map((session) => {
            const isChecked = selectedSessions.has(session.id)
            return (
              <div
                key={session.id}
                onClick={() => (isSelectionMode ? onToggleSessionSelection(session.id) : onSelectSession(session.id))}
                className="group border border-zinc-800/80 bg-[#1b1b1b]/40 hover:bg-zinc-900/50 rounded-lg p-4 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {isSelectionMode && (
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                            isChecked ? 'bg-zinc-100 border-zinc-100 text-zinc-900' : 'border-zinc-600'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </span>
                      )}
                      <h2 className="truncate font-semibold text-zinc-100 text-sm">{session.title}</h2>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2">
                      {(session.message_count || 0).toString()} messages - {formatRelativeTime(session.last_message_at || session.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        const title = window.prompt('Rename chat', session.title)
                        if (title) onRenameSession(session.id, title)
                      }}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation()
                        onDeleteSession(session.id)
                      }}
                      className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {session.summary && <p className="mt-3 line-clamp-2 text-xs text-zinc-500">{session.summary}</p>}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

function ProvidersView({
  providers,
  providerForm,
  editingProviderId,
  onFormChange,
  onSave,
  onCancel,
  onEdit,
  onDelete,
}: {
  providers: Provider[]
  providerForm: typeof emptyProviderForm
  editingProviderId: string | null
  onFormChange: (value: typeof emptyProviderForm) => void
  onSave: () => void
  onCancel: () => void
  onEdit: (provider: Provider) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar py-8 px-6 mx-auto w-full max-w-5xl flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold font-helvetica tracking-tighter text-zinc-100">Providers</h1>
        <p className="text-sm text-zinc-500 font-helvetica tracking-tighter mt-1">
          Add hosted and local models without editing environment files.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
        <div className="flex flex-col gap-3">
          {providers.map((provider) => (
            <div key={provider.id} className="border border-zinc-800 bg-[#1b1b1b]/40 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-zinc-100 truncate">{provider.name}</h2>
                    {provider.is_active && (
                      <span className="text-[10px] uppercase tracking-wide rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">{provider.provider_type}</p>
                  <p className="text-sm text-zinc-300 mt-3 truncate">{provider.model}</p>
                  {provider.base_url && <p className="text-xs text-zinc-500 mt-1 truncate">{provider.base_url}</p>}
                  <p className="text-xs text-zinc-600 mt-1">
                    Key: {provider.api_key_masked || 'not set'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onEdit(provider)}
                    className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => onDelete(provider.id)}
                    className="p-2 rounded hover:bg-zinc-800 text-zinc-400 hover:text-red-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="border border-zinc-800 bg-[#1b1b1b]/40 rounded-lg p-4 h-fit">
          <h2 className="font-semibold text-zinc-100 mb-4">{editingProviderId ? 'Edit provider' : 'Add provider'}</h2>
          <div className="flex flex-col gap-3">
            <input
              value={providerForm.name}
              onChange={(event) => onFormChange({ ...providerForm, name: event.target.value })}
              placeholder="Name"
              className="bg-[#171717] border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700"
            />
            <select
              value={providerForm.provider_type}
              onChange={(event) => onFormChange({ ...providerForm, provider_type: event.target.value })}
              className="bg-[#171717] border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700"
            >
              <option value="ollama">Ollama local</option>
              <option value="anthropic">Anthropic</option>
              <option value="openai_compatible">OpenAI compatible</option>
            </select>
            <input
              value={providerForm.model}
              onChange={(event) => onFormChange({ ...providerForm, model: event.target.value })}
              placeholder="Model"
              className="bg-[#171717] border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700"
            />
            <input
              value={providerForm.base_url}
              onChange={(event) => onFormChange({ ...providerForm, base_url: event.target.value })}
              placeholder="Base URL"
              className="bg-[#171717] border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700"
            />
            <input
              value={providerForm.api_key}
              onChange={(event) => onFormChange({ ...providerForm, api_key: event.target.value })}
              placeholder={editingProviderId ? 'New API key, optional' : 'API key'}
              type="password"
              className="bg-[#171717] border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-700"
            />
            <label className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={providerForm.is_active}
                onChange={(event) => onFormChange({ ...providerForm, is_active: event.target.checked })}
              />
              Make active
            </label>
            <div className="flex items-center gap-2 pt-2">
              <button onClick={onSave} className="bg-zinc-100 text-zinc-900 rounded-lg px-4 py-2 text-xs font-semibold">
                Save
              </button>
              <button onClick={onCancel} className="border border-zinc-800 text-zinc-300 rounded-lg px-4 py-2 text-xs">
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
