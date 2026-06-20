import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, Circle, Loader2, X } from 'lucide-react'

export interface ThinkingStep {
  id: string
  text: string
  status: 'pending' | 'running' | 'completed' | 'failed'
}

interface ThinkingProcessProps {
  steps: ThinkingStep[]
  isCollapsedByDefault?: boolean
}

function StepIcon({ status }: { status: ThinkingStep['status'] }) {
  if (status === 'completed') return 
  if (status === 'failed') return 
  if (status === 'running') return 
  return <Circle className="w-3.5 h-3.5 text-zinc-700" />
}

export function Spinner({ steps, isCollapsedByDefault = true }: ThinkingProcessProps) {
  const [isOpen, setIsOpen] = useState(isCollapsedByDefault)

  if (steps.length === 0) return null

  const running = steps.find((step) => step.status === 'running')
  const completedCount = steps.filter((step) => step.status === 'completed').length
  const title = running?.text || `${completedCount}/${steps.length} steps complete`

  return (
    <div className="w-full text-zinc-400 select-none">
      <div className="flex items-center gap-1.5 text-xs font-helvetica tracking-tighter">
        <StepIcon status={running ? 'running' : 'completed'} />
        <span className="text-zinc-500 font-medium truncate">{title}</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-0.5 rounded hover:bg-zinc-800/60 transition-colors cursor-pointer bg-transparent border-none focus:outline-none flex items-center justify-center"
          title="Toggle workflow details"
        >
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden pl-1 mt-2 flex flex-col gap-1.5"
          >
            {steps.map((step) => (
              <div key={step.id} className="flex items-center gap-2 text-xs text-zinc-500">
                <StepIcon status={step.status} />
                <span className={step.status === 'running' ? 'text-zinc-300' : ''}>{step.text}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
