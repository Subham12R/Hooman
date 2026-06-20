import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Loader2 } from 'lucide-react'

export interface ThinkingStep {
  id: string
  text: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface SpinnerProps {
  steps: ThinkingStep[]
  isCollapsedByDefault?: boolean
}

function StepIcon({ status }: { status: ThinkingStep['status'] }) {
  if (status === 'running') {
    return <Loader2 className="w-3.5 h-3.5 dark:text-zinc-500 text-zinc-400 animate-spin shrink-0" />
  }
  if (status === 'completed' || status === 'failed') {
    return (
      <span className="w-1.5 h-1.5 rounded-full dark:bg-zinc-700 bg-zinc-300 shrink-0 mx-px" />
    )
  }
  return <span className="w-3.5 h-3.5 shrink-0" />
}

function StepRow({ step }: { step: ThinkingStep }) {
  return (
    <div className="flex items-center gap-2.5 min-h-5">
      <StepIcon status={step.status} />
      <span
        className={`text-xs font-helvetica tracking-tighter leading-none ${
          step.status === 'running' ? 'dark:text-zinc-300 text-zinc-700' : 'dark:text-zinc-600 text-zinc-500'
        }`}
      >
        {step.text}{step.status === 'running' ? '...' : ''}
      </span>
    </div>
  )
}

function FlatStepList({ steps }: { steps: ThinkingStep[] }) {
  const visible = steps.filter((s) => s.status !== 'pending')
  return (
    <div className="flex flex-col gap-1.5">
      {visible.map((step) => (
        <StepRow key={step.id} step={step} />
      ))}
    </div>
  )
}

export function Spinner({ steps, isCollapsedByDefault = true }: SpinnerProps) {
  const [expanded, setExpanded] = useState(false)

  const completedCount = steps.filter((s) => s.status === 'completed' || s.status === 'failed').length
  const allDone = steps.length > 0 && steps.every((s) => s.status === 'completed' || s.status === 'failed')

  // Done — collapse to tiny toggle
  if (isCollapsedByDefault && allDone) {
    return (
      <div className="mb-1">
        <button
          onClick={() => setExpanded((p) => !p)}
          className="flex items-center gap-1 text-[11px] dark:text-zinc-700 text-zinc-500 dark:hover:text-zinc-500 hover:text-zinc-700 transition-colors font-helvetica tracking-tighter select-none bg-transparent border-none p-0 cursor-pointer"
        >
          <span>{completedCount} steps</span>
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
              <FlatStepList steps={steps} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // No steps yet — single Loader2 placeholder
  if (steps.length === 0) {
    return (
      <div className="flex items-center gap-2.5 mb-2 min-h-5">
        <Loader2 className="w-3.5 h-3.5 dark:text-zinc-500 text-zinc-400 animate-spin shrink-0" />
        <span className="text-xs dark:text-zinc-500 text-zinc-400 font-helvetica tracking-tighter">Thinking...</span>
      </div>
    )
  }

  // Streaming — show all visible steps
  return (
    <div className="mb-2">
      <FlatStepList steps={steps} />
    </div>
  )
}
