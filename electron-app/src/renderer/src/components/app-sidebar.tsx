import * as React from "react"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  BubbleChatIcon,
  PuzzleIcon,
  Settings01Icon,
  PinIcon,
} from "@hugeicons/core-free-icons"
import { Pencil, Pin, Trash2 } from "lucide-react"
import AppIcon from "@/assets/images/logo.png"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar"

interface Session {
  id: string
  title: string
  pinned?: boolean
}

interface UserProfile {
  name: string
  email: string
  avatar: string
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  sessions: Session[]
  currentSessionId: string | null
  activeView?: 'chat' | 'chats-list' | 'providers' | 'settings'
  streamingSessionIds?: string[]
  userProfile?: UserProfile
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onRenameSession: (id: string, newTitle: string) => void
  onDeleteSession: (id: string) => void
  onPinSession?: (id: string) => void
  onShowChatsList?: () => void
  onShowProviders?: () => void
  onShowSettings?: () => void
}

export function AppSidebar({
  sessions,
  currentSessionId,
  activeView = 'chat',
  streamingSessionIds = [],
  userProfile,
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onPinSession,
  onShowChatsList,
  onShowProviders,
  onShowSettings,
  ...props
}: AppSidebarProps) {
  const { state } = useSidebar()
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  const navItems = [
    { title: "New Chat", icon: Add01Icon, action: onCreateSession },
    { title: "Chats", icon: BubbleChatIcon, action: onShowChatsList, view: "chats-list" },
    { title: "Providers", icon: PuzzleIcon, action: onShowProviders, view: "providers" },
    { title: "Settings", icon: Settings01Icon, action: onShowSettings, view: "settings" },
  ]

  const user = userProfile && (userProfile.name || userProfile.email)
    ? { name: userProfile.name || 'User', email: userProfile.email || '', avatar: userProfile.avatar || '' }
    : { name: 'User', email: '', avatar: '' }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {state === "collapsed" ? (
              <div className="flex h-9 w-9 items-center justify-center">
                <img src={AppIcon} alt="Hooman" className="h-7 w-7 rounded-full" />
              </div>
            ) : (
              <SidebarMenuButton size="lg" asChild>
                <div className="flex items-center gap-2.5">
                  <img src={AppIcon} alt="Hooman Logo" className="h-7 w-7 rounded-full" />
                  <span className="font-semibold tracking-tight text-base font-helvetica">Hooman</span>
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="px-2 pt-1 text-zinc-100 font-helvetica tracking-tighter">
          {navItems.map((item) => {
            const isActive = item.view ? activeView === item.view : false
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isActive}
                  onClick={item.action}
                >
                  <HugeiconsIcon icon={item.icon} size={16} />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        <SidebarSeparator />

        <SidebarMenu className="px-2 pt-1 text-zinc-100 font-helvetica tracking-tighter">
          {sessions.map((conv) => {
            const isSelected = conv.id === currentSessionId
            const isEditing = editingSessionId === conv.id
            const isStreaming = streamingSessionIds.includes(conv.id)

            return (
              <SidebarMenuItem key={conv.id} className="group/item relative">
                {isEditing ? (
                  <div className="px-2 py-1.5 w-full">
                    <input
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600 font-helvetica"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { onRenameSession(conv.id, editingTitle); setEditingSessionId(null) }
                        else if (e.key === "Escape") setEditingSessionId(null)
                      }}
                      onBlur={() => { onRenameSession(conv.id, editingTitle); setEditingSessionId(null) }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div className="flex w-full items-center justify-between">
                    <SidebarMenuButton
                      tooltip={conv.title}
                      isActive={isSelected}
                      onClick={() => onSelectSession(conv.id)}
                      className="flex-1 pr-10"
                    >
                      {isStreaming ? (
                        <svg className="animate-spin h-3.5 w-3.5 text-zinc-400 mr-0.5 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : conv.pinned ? (
                        <HugeiconsIcon icon={PinIcon} size={13} className="text-zinc-500 shrink-0" />
                      ) : (
                        <HugeiconsIcon icon={BubbleChatIcon} size={16} className="shrink-0" />
                      )}
                      <span className="truncate">{conv.title}</span>
                    </SidebarMenuButton>

                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity z-10">
                      {onPinSession && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onPinSession(conv.id) }}
                          className={`p-1 rounded hover:bg-zinc-800 transition-colors ${conv.pinned ? 'text-zinc-300' : 'text-zinc-500 hover:text-zinc-300'}`}
                          title={conv.pinned ? "Unpin" : "Pin"}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingSessionId(conv.id); setEditingTitle(conv.title) }}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {state !== 'collapsed' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteSession(conv.id) }}
                          className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} onSettings={onShowSettings} />
      </SidebarFooter>
    </Sidebar>
  )
}
