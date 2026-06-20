import { useState, useRef, useEffect } from 'react'

export const MODELS = [
  { id: 'claude-opus-4-8',          label: 'Claude Opus 4.8',    short: 'Opus 4.8'    },
  { id: 'claude-sonnet-4-6',        label: 'Claude Sonnet 4.6',  short: 'Sonnet 4.6'  },
  { id: 'claude-haiku-4-5-20251001',label: 'Claude Haiku 4.5',   short: 'Haiku 4.5'   },
]

interface Props {
  value: string
  onChange: (model: string) => void
}

export function ModelSelector({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const current = MODELS.find(m => m.id === value) ?? MODELS[1]

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 font-helvetica tracking-tighter text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
          >
          <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
          <span>{current.short}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 rounded-xl bg-[#171717] border-2 border-zinc-800 shadow-2xl z-50 overflow-hidden p-1 gap-2">
          {MODELS.map(model => ( 
            <button
              key={model.id}
              onClick={() => { onChange(model.id); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 text-sm font-helvetica tracking-tighter transition-colors hover:bg-zinc-800 rounded-md  ${
                model.id === value
                  ? 'text-zinc-100 '
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {model.label}
              {model.id === value && (
                <span className="float-right text-zinc-500 text-xs mt-0.5">✓</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
