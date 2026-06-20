import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon, MoreHorizontalIcon, Delete01Icon } from "@hugeicons/core-free-icons"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavConversations({
  conversations,
}: {
  conversations: { id: string; title: string }[]
}) {
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Conversations</SidebarGroupLabel>
      <SidebarGroupAction title="New conversation">
        <HugeiconsIcon icon={Add01Icon} size={16} />
        <span className="sr-only">New conversation</span>
      </SidebarGroupAction>
      <SidebarGroupContent>
        <SidebarMenu>
          {conversations.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-sidebar-foreground/50">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <SidebarMenuItem key={conv.id}>
                <SidebarMenuButton tooltip={conv.title}>
                  <span className="truncate">{conv.title}</span>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction showOnHover>
                      <HugeiconsIcon icon={MoreHorizontalIcon} size={16} />
                      <span className="sr-only">More</span>
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    className="w-40 rounded-lg"
                    side={isMobile ? "bottom" : "right"}
                    align={isMobile ? "end" : "start"}
                  >
                    <DropdownMenuItem>
                      <HugeiconsIcon icon={Delete01Icon} size={16} />
                      <span>Delete</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            ))
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
