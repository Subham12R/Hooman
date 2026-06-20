import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Loader2 } from 'lucide-react'

export interface TraceEvent {
  type: 'trace'
  stage: 'plan' | 'search' | 'fetch' | 'synthesize'
  status: 'running' | 'completed'
  session_id?: string
  request_id?: string
  data?: {
    queries?: string[]
    query?: string
    results?: { title: string; url: string; snippet: string }[]
    url?: string
    title?: string
    preview?: string
  }
}

interface ResearchTraceProps {
  traces: TraceEvent[]
  isStreaming: boolean
}

// ── icons ──────────────────────────────────────────────────────────────────

function RunningIcon() {
  return <Loader2 className="w-3.5 h-3.5 dark:text-zinc-500 text-zinc-400 animate-spin shrink-0" />
}

function DoneIcon() {
  return <span className="w-1.5 h-1.5 rounded-full dark:bg-zinc-700 bg-zinc-300 shrink-0 mx-px" />
}

// ── data helpers ────────────────────────────────────────────────────────────

function planLabel(traces: TraceEvent[]): string {
  const done = traces.find((t) => t.stage === 'plan' && t.status === 'completed')
  if (done?.data?.queries) return `Planned ${done.data.queries.length} queries`
  return 'Planning queries'
}

function searchLabel(traces: TraceEvent[]): string {
  const done = traces.filter((t) => t.stage === 'search' && t.status === 'completed')
  if (done.length > 0) return `Searched the web for ${done.length} ${done.length === 1 ? 'query' : 'queries'}`
  return 'Searching the web'
}

function fetchLabel(traces: TraceEvent[]): string {
  const done = traces.filter((t) => t.stage === 'fetch' && t.status === 'completed' && t.data?.url)
  if (done.length > 0) return `Read ${done.length} ${done.length === 1 ? 'source' : 'sources'}`
  return 'Fetching sources'
}

// ── sub-detail rows ─────────────────────────────────────────────────────────

function PlanDetails({ traces }: { traces: TraceEvent[] }) {
  const done = traces.find((t) => t.stage === 'plan' && t.status === 'completed')
  if (!done?.data?.queries?.length) return null
  return (
    <div className="flex flex-col gap-0.5 pl-6 mt-0.5">
      {done.data.queries.map((q, i) => (
        <span key={i} className="text-[11px] dark:text-zinc-700 text-zinc-500 font-helvetica tracking-tighter leading-snug">
          {i + 1}. {q}
        </span>
      ))}
    </div>
  )
}

function SearchDetails({ traces }: { traces: TraceEvent[] }) {
  const groups = traces.filter((t) => t.stage === 'search' && t.status === 'completed' && t.data?.results?.length)
  if (!groups.length) return null
  return (
    <div className="flex flex-col gap-1 pl-6 mt-0.5">
      {groups.map((t, gi) =>
        (t.data?.results || []).slice(0, 2).map((r, i) => (
          <span key={`${gi}-${i}`} className="text-[11px] dark:text-zinc-700 text-zinc-500 font-helvetica tracking-tighter leading-snug truncate">
            {r.title || r.url}
          </span>
        ))
      )}
    </div>
  )
}

function FetchDetails({ traces }: { traces: TraceEvent[] }) {
  const done = traces.filter((t) => t.stage === 'fetch' && t.status === 'completed' && t.data?.url)
  if (!done.length) return null
  return (
    <div className="flex flex-col gap-0.5 pl-6 mt-0.5">
      {done.map((t, i) => (
        <span key={i} className="text-[11px] dark:text-zinc-700 text-zinc-500 font-helvetica tracking-tighter leading-snug truncate">
          {t.data?.title || t.data?.url}
        </span>
      ))}
    </div>
  )
}

// ── stage row ───────────────────────────────────────────────────────────────

type StageStatus = 'pending' | 'running' | 'completed'

function stageStatus(traces: TraceEvent[], stage: TraceEvent['stage']): StageStatus {
  const events = traces.filter((t) => t.stage === stage)
  if (events.some((t) => t.status === 'completed')) return 'completed'
  if (events.some((t) => t.status === 'running')) return 'running'
  return 'pending'
}

interface StageRowProps {
  label: string
  status: StageStatus
  details?: React.ReactNode
}

function StageRow({ label, status, details }: StageRowProps) {
  if (status === 'pending') return null
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 min-h-5">
        {status === 'running' ? <RunningIcon /> : <DoneIcon />}
        <span
          className={`text-xs font-helvetica tracking-tighter leading-none ${
            status === 'running' ? 'dark:text-zinc-300 text-zinc-700' : 'dark:text-zinc-600 text-zinc-500'
          }`}
        >
          {label}{status === 'running' ? '...' : ''}
        </span>
      </div>
      {status === 'completed' && details}
    </div>
  )
}

// ── main component ──────────────────────────────────────────────────────────

export function ResearchTrace({ traces, isStreaming }: ResearchTraceProps) {
  const [expanded, setExpanded] = useState(false)

  const planStatus = stageStatus(traces, 'plan')
  const searchStatus = stageStatus(traces, 'search')
  const fetchStatus = stageStatus(traces, 'fetch')
  const synthStatus = stageStatus(traces, 'synthesize')
  const allDone = !isStreaming && synthStatus === 'completed'
  const totalSteps = [planStatus, searchStatus, fetchStatus, synthStatus].filter((s) => s !== 'pending').length

  if (traces.length === 0) {
    return (
      <div className="flex items-center gap-2.5 mb-2 min-h-5">
        <RunningIcon />
        <span className="text-xs dark:text-zinc-500 text-zinc-400 font-helvetica tracking-tighter">Initializing...</span>
      </div>
    )
  }

  if (allDone) {
    return (
      <div className="mb-1">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1 text-[11px] dark:text-zinc-700 text-zinc-500 dark:hover:text-zinc-500 hover:text-zinc-700 transition-colors font-helvetica tracking-tighter select-none bg-transparent border-none p-0 cursor-pointer"
        >
          <span>{totalSteps} steps</span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden mt-2"
            >
              <StepsFlatList traces={traces} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5 mb-2">
      <StepsFlatList traces={traces} />
    </div>
  )
}

function StepsFlatList({ traces }: { traces: TraceEvent[] }) {
  return (
    <div className="flex flex-col gap-1.5">
      <StageRow
        label={planLabel(traces)}
        status={stageStatus(traces, 'plan')}
        details={<PlanDetails traces={traces} />}
      />
      <StageRow
        label={searchLabel(traces)}
        status={stageStatus(traces, 'search')}
        details={<SearchDetails traces={traces} />}
      />
      <StageRow
        label={fetchLabel(traces)}
        status={stageStatus(traces, 'fetch')}
        details={<FetchDetails traces={traces} />}
      />
      <StageRow
        label="Writing report"
        status={stageStatus(traces, 'synthesize')}
      />
    </div>
  )
}
