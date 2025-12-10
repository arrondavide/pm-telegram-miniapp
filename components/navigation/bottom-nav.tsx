"use client"

import { ClipboardList, Users, BarChart3, User, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAppStore } from "@/lib/store"

interface BottomNavProps {
  activeScreen: string
  onNavigate: (screen: string) => void
  userRole: "admin" | "manager" | "employee"
}

export function BottomNav({ activeScreen, onNavigate, userRole }: BottomNavProps) {
  const { getUnreadNotificationCount } = useAppStore()
  const unreadCount = getUnreadNotificationCount()

  const navItems = [
    { id: "tasks", label: "Tasks", icon: ClipboardList },
    { id: "notifications", label: "Alerts", icon: Bell, badge: unreadCount },
    ...(userRole !== "employee" ? [{ id: "team", label: "Team", icon: Users }] : []),
    { id: "stats", label: "Stats", icon: BarChart3 },
    { id: "profile", label: "Profile", icon: User },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background">
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-4">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeScreen === item.id
          const badge = "badge" in item ? item.badge : 0

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2 transition-all",
                isActive ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <div className="relative">
                <Icon
                  className={cn("h-5 w-5 transition-transform", isActive && "scale-110")}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {badge > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </div>
              <span className={cn("text-xs", isActive ? "font-semibold" : "font-medium")}>{item.label}</span>
              {isActive && <span className="absolute -bottom-0 h-0.5 w-8 rounded-full bg-foreground" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
