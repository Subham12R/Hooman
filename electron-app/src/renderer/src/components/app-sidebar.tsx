import * as React from "react"
import { useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  BubbleChatIcon,
  Clock01Icon,
  BookOpen01Icon,
  Robot01Icon,
  PuzzleIcon,
} from "@hugeicons/core-free-icons"
import { Pencil, Trash2 } from "lucide-react"
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

const navItems = [
  { title: "New Chat", icon: Add01Icon },
  { title: "Chats", icon: BubbleChatIcon },
  { title: "Agent", icon: Robot01Icon },
  { title: "Providers", icon: PuzzleIcon },
  { title: "Scheduled", icon: Clock01Icon },
  { title: "Library", icon: BookOpen01Icon },
]

const user = {
  name: "Rikk",
  email: "rikk4335@gmail.com",
  avatar: "",
}

interface Session {
  id: string
  title: string
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  sessions: Session[]
  currentSessionId: string | null
  activeView?: 'chat' | 'chats-list' | 'providers'
  streamingSessionIds?: string[]
  onSelectSession: (id: string) => void
  onCreateSession: () => void
  onRenameSession: (id: string, newTitle: string) => void
  onDeleteSession: (id: string) => void
  onShowChatsList?: () => void
  onShowProviders?: () => void
}

export function AppSidebar({
  sessions,
  currentSessionId,
  activeView = 'chat',
  streamingSessionIds = [],
  onSelectSession,
  onCreateSession,
  onRenameSession,
  onDeleteSession,
  onShowChatsList,
  onShowProviders,
  ...props
}: AppSidebarProps) {
  const { state } = useSidebar()
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState("")

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            {state === "collapsed" ? (
              <div className="flex h-9 w-9 items-center justify-center">
                <img
                  src={AppIcon}
                  alt="Hooman"
                  className="h-7 w-7 rounded-full"
                />
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
        {/* Navigation Items */}
        <SidebarMenu className="px-2 pt-1 text-zinc-100 font-helvetica tracking-tighter">
          {navItems.map((item) => {
            const isChatsActive = item.title === "Chats" && activeView === "chats-list"
            const isProvidersActive = item.title === "Providers" && activeView === "providers"
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  tooltip={item.title}
                  isActive={isChatsActive || isProvidersActive}
                  onClick={
                    item.title === "New Chat"
                      ? onCreateSession
                      : item.title === "Chats"
                      ? onShowChatsList
                      : item.title === "Providers"
                      ? onShowProviders
                      : undefined
                  }
                >
                  <HugeiconsIcon icon={item.icon} size={16} />
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>

        <SidebarSeparator />

        {/* Dynamic Conversations List */}
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
                        if (e.key === "Enter") {
                          onRenameSession(conv.id, editingTitle)
                          setEditingSessionId(null)
                        } else if (e.key === "Escape") {
                          setEditingSessionId(null)
                        }
                      }}
                      onBlur={() => {
                        onRenameSession(conv.id, editingTitle)
                        setEditingSessionId(null)
                      }}
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
                        <svg className="animate-spin h-3.5 w-3.5 text-zinc-400 mr-0.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <HugeiconsIcon icon={BubbleChatIcon} size={16} />
                      )}
                      <span className="truncate">{conv.title}</span>
                    </SidebarMenuButton>

                    {/* Action buttons visible on item hover */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditingSessionId(conv.id)
                          setEditingTitle(conv.title)
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                        title="Rename Chat"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteSession(conv.id)
                        }}
                        className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
                        title="Delete Chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
