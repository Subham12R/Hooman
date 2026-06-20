import { useEffect, useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Settings01Icon,
  UserIcon,
  
  InformationCircleIcon,
} from '@hugeicons/core-free-icons'

const HTTP_URL = (import.meta.env.VITE_BACKEND_HTTP_URL as string) || 'http://localhost:8000'

interface UsageStat {
  model: string
  provider_type: string
  requests: number
  total_input_chars: number
  total_output_chars: number
  last_used: string
}

interface UserProfile {
  name: string
  email: string
  avatar: string
}

interface SettingsViewProps {
  onProfileChange?: (profile: UserProfile) => void
}

function estimateTokens(chars: number): string {
  const tokens = Math.round(chars / 4)
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`
  return String(tokens)
}

function formatDate(iso: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const BASE_URL_GUIDE: Record<string, { label: string; example: string; note: string }> = {
  anthropic: {
    label: 'Anthropic',
    example: '(leave empty)',
    note: 'Anthropic uses its own SDK endpoint. No base URL needed — leave the field blank.',
  },
  ollama: {
    label: 'Ollama (local)',
    example: 'http://localhost:11434/v1',
    note: 'Default local Ollama endpoint. Change port only if you customized Ollama startup.',
  },
  openai_compatible: {
    label: 'OpenAI-compatible',
    example: 'https://api.groq.com/openai/v1',
    note: 'Use the full base URL including /v1. Examples: Groq → api.groq.com/openai/v1 · OpenRouter → openrouter.ai/api/v1 · Together → api.together.xyz/v1',
  },
}

// ── Profile section ────────────────────────────────────────────────────────────

function ProfileSection({ onProfileChange }: { onProfileChange?: (p: UserProfile) => void }) {
  const [profile, setProfile] = useState<UserProfile>({ name: '', email: '', avatar: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`${HTTP_URL}/api/settings/user`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setProfile(d) })
      .catch(() => {})
  }, [])

  async function save(updated: UserProfile) {
    setSaving(true)
    setSaved(false)
    try {
      await fetch(`${HTTP_URL}/api/settings/user`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated),
      })
      setSaved(true)
      onProfileChange?.(updated)
      setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const updated = { ...profile, avatar: reader.result as string }
      setProfile(updated)
      save(updated)
    }
    reader.readAsDataURL(file)
  }

  const initials = profile.name ? profile.name.slice(0, 2).toUpperCase() : 'U'

  return (
    <div className="border border-zinc-800 bg-[#1b1b1b]/40 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-5">
        <HugeiconsIcon icon={UserIcon} size={16} className="text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100 font-helvetica tracking-tighter">Profile</h2>
      </div>

      <div className="flex items-start gap-6">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-16 h-16 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
            {profile.avatar ? (
              <img src={profile.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="text-zinc-400 text-lg font-semibold font-helvetica">{initials}</span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center hover:bg-zinc-600 transition-colors"
            title="Upload photo"
          >
            <Camera className="w-3 h-3 text-zinc-300" />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3 flex-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-helvetica tracking-tighter">Display name</label>
              <input
                value={profile.name}
                onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                onBlur={() => save(profile)}
                placeholder="Your name"
                className="bg-[#171717] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 font-helvetica"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-zinc-500 font-helvetica tracking-tighter">Email</label>
              <input
                value={profile.email}
                onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                onBlur={() => save(profile)}
                placeholder="you@example.com"
                className="bg-[#171717] border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-600 font-helvetica"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 h-5">
            {saving && <Loader2 className="w-3.5 h-3.5 text-zinc-500 animate-spin" />}
            {saved && <span className="text-xs text-zinc-500 font-helvetica">Saved</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Usage stats section ────────────────────────────────────────────────────────

function UsageSection() {
  const [stats, setStats] = useState<UsageStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${HTTP_URL}/api/stats/usage`)
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setStats(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const totalRequests = stats.reduce((s, r) => s + r.requests, 0)
  const totalInputChars = stats.reduce((s, r) => s + r.total_input_chars, 0)
  const totalOutputChars = stats.reduce((s, r) => s + r.total_output_chars, 0)

  return (
    <div className="border border-zinc-800 bg-[#1b1b1b]/40 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-5">
        
        <h2 className="text-sm font-semibold text-zinc-100 font-helvetica tracking-tighter">Model usage</h2>
        <span className="text-xs text-zinc-600 font-helvetica">tokens estimated at 4 chars each</span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-zinc-600">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Loading stats...</span>
        </div>
      ) : stats.length === 0 ? (
        <p className="text-xs text-zinc-600 font-helvetica">No usage data yet. Send a few messages to see stats here.</p>
      ) : (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total requests', value: totalRequests.toLocaleString() },
              { label: 'Est. input tokens', value: estimateTokens(totalInputChars) },
              { label: 'Est. output tokens', value: estimateTokens(totalOutputChars) },
            ].map((item) => (
              <div key={item.label} className="bg-zinc-900/40 border border-zinc-800/60 rounded-lg p-3">
                <p className="text-xs text-zinc-500 font-helvetica tracking-tighter mb-1">{item.label}</p>
                <p className="text-lg font-semibold text-zinc-100 font-helvetica tracking-tight">{item.value}</p>
              </div>
            ))}
          </div>

          {/* Per-model table */}
          <table className="w-full text-xs font-helvetica tracking-tighter">
            <thead>
              <tr className="border-b border-zinc-800">
                {['Model', 'Type', 'Requests', 'Input tokens', 'Output tokens', 'Last used'].map((h) => (
                  <th key={h} className="text-left text-zinc-500 pb-2 pr-4 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((row, i) => (
                <tr key={i} className="border-b border-zinc-800/40 last:border-0">
                  <td className="py-2.5 pr-4 text-zinc-200 truncate max-w-[180px]">{row.model}</td>
                  <td className="py-2.5 pr-4 text-zinc-500">{row.provider_type}</td>
                  <td className="py-2.5 pr-4 text-zinc-300">{row.requests.toLocaleString()}</td>
                  <td className="py-2.5 pr-4 text-zinc-300">{estimateTokens(row.total_input_chars)}</td>
                  <td className="py-2.5 pr-4 text-zinc-300">{estimateTokens(row.total_output_chars)}</td>
                  <td className="py-2.5 text-zinc-600">{formatDate(row.last_used)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

// ── Base URL guide section ─────────────────────────────────────────────────────

function BaseUrlGuideSection() {
  return (
    <div className="border border-zinc-800 bg-[#1b1b1b]/40 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-5">
        <HugeiconsIcon icon={InformationCircleIcon} size={16} className="text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-100 font-helvetica tracking-tighter">Provider base URL guide</h2>
      </div>

      <div className="flex flex-col gap-4">
        {Object.entries(BASE_URL_GUIDE).map(([key, info]) => (
          <div key={key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline gap-3">
              <span className="text-xs font-semibold text-zinc-300 font-helvetica tracking-tighter w-36 shrink-0">{info.label}</span>
              <code className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 rounded px-2 py-0.5 font-mono">{info.example}</code>
            </div>
            <p className="text-xs text-zinc-600 font-helvetica tracking-tighter pl-[9.5rem]">{info.note}</p>
          </div>
        ))}

        <div className="mt-2 p-3 bg-zinc-900/40 border border-zinc-800/60 rounded-lg">
          <p className="text-xs text-zinc-500 font-helvetica tracking-tighter leading-relaxed">
            The API key field is stored securely in your OS keyring (Windows Credential Manager). It is never written to disk in plaintext.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────────

export interface UserProfile_ {
  name: string
  email: string
  avatar: string
}

export function SettingsView({ onProfileChange }: SettingsViewProps) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar py-8 px-6 mx-auto w-full max-w-3xl flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={Settings01Icon} size={20} className="text-zinc-400" />
        <h1 className="text-3xl font-bold font-helvetica tracking-tighter text-zinc-100">Settings</h1>
      </div>

      <ProfileSection onProfileChange={onProfileChange} />
      <UsageSection />
      <BaseUrlGuideSection />
    </div>
  )
}
