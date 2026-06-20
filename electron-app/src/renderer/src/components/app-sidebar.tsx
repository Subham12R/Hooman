import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  BubbleChatIcon,
  Clock01Icon,
  BookOpen01Icon,
  Robot01Icon,
  PuzzleIcon,
} from "@hugeicons/core-free-icons"
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
  { title: "Plugins", icon: PuzzleIcon },
  { title: "Scheduled", icon: Clock01Icon },
  { title: "Library", icon: BookOpen01Icon },
]

const recentConversations = [
  { id: 1, title: "Chat with GPT-4" },
]

const user = {
  name: "Rikk",
  email: "rikk4335@gmail.com",
  avatar: "",
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { state } = useSidebar()

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
        <SidebarMenu className="px-2 pt-1 text-zinc-100 font-helvetica tracking-tighter">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title}>
                <HugeiconsIcon icon={item.icon} size={16} />
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarSeparator />
          <SidebarMenu className="px-2 pt-1 text-zinc-100 font-helvetica tracking-tighter">
            {recentConversations.map((conv) => (
              <SidebarMenuItem key={conv.id}>
                <SidebarMenuButton tooltip={conv.title}>
                  <HugeiconsIcon icon={BubbleChatIcon} size={16} />
                  <span>{conv.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
