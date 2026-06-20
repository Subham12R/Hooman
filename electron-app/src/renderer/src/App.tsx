import { useEffect, useState, useRef } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarProvider, SidebarTrigger, SidebarInset } from '@/components/ui/sidebar'
import { PromptInputBox } from '@/components/ui/ai-prompt-box'
import { ModelSelector } from '@/components/model-selector'

type Message = {
  from: 'user' | 'assistant'
  text: string
  streaming?: boolean
}

const WS_URL = import.meta.env.VITE_BACKEND_WS_URL as string
const DEFAULT_MODEL = 'claude-sonnet-4-6'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [connected, setConnected] = useState(false)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL)

  const wsRef = useRef<WebSocket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!WS_URL) {
      console.error('WebSocket URL is not defined in environment variables')
      return
    }

    let cancelled = false
    let reconnectTimer: ReturnType<typeof setTimeout>

    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setConnected(true)
      }

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === 'delta') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.from === 'assistant' && last.streaming) {
              const updated = [...prev]
              updated[updated.length - 1] = { ...last, text: last.text + data.text }
              return updated
            }
            return [...prev, { from: 'assistant', text: data.text, streaming: true }]
          })
        }

        if (data.type === 'done') {
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last) return prev
            const updated = [...prev]
            updated[updated.length - 1] = { ...last, streaming: false }
            return updated
          })
        }

        if (data.type === 'error') {
          setMessages((prev) => [...prev, { from: 'assistant', text: `Error: ${data.message}` }])
        }
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected — retrying in 2s')
        setConnected(false)
        if (!cancelled) {
          reconnectTimer = setTimeout(connect, 2000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      cancelled = true
      clearTimeout(reconnectTimer)
      wsRef.current?.close()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function handleSend(text: string): void {
    const trimmed = text.trim()
    if (!trimmed || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ text: trimmed, model: selectedModel }))
    setMessages((prev) => [...prev, { from: 'user', text: trimmed }])
  }

  const isEmpty = messages.length === 0

  return (
    <SidebarProvider className="bg-[#171717] text-zinc-100">
      <AppSidebar />
      <SidebarInset className="bg-[#171717] text-zinc-100">
        <header className="flex h-12 shrink-0 items-center justify-between px-4">
          <SidebarTrigger />
          <div className="flex items-center gap-2.5 font-helvetica tracking-tighter">
            <ModelSelector value={selectedModel} onChange={setSelectedModel} />
            <span className="text-zinc-700 text-xs">|</span>
            <span className={`text-sm ${connected ? 'text-emerald-400' : 'text-zinc-600'}`}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </header>

        {isEmpty ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
            <p className="font-helvetica text-2xl tracking-tighter text-zinc-300">
              What can I do for you?
            </p>
            <div className="w-full max-w-2xl">
              <PromptInputBox onSend={handleSend} placeholder="Message Hooman..." />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-1 flex-col overflow-y-auto gap-3 px-4 py-4 mx-auto w-full max-w-2xl">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`max-w-xl rounded-xl px-4 py-2.5 text-sm leading-relaxed font-helvetica ${
                    msg.from === 'user'
                      ? 'ml-auto text-zinc-100'
                      : 'text-zinc-300'
                  }`}
                >
                  {msg.text}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 px-4 pb-4">
              <div className="mx-auto w-full max-w-2xl">
                <PromptInputBox onSend={handleSend} placeholder="Message Hooman..." />
              </div>
            </div>
          </>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
