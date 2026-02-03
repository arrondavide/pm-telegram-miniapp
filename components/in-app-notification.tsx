"use client"

import { useEffect, useState } from "react"
import { X, Bell, ClipboardList, MessageSquare, CheckCheck, Clock } from "lucide-react"
import { useNotificationStore } from "@/lib/stores/notification.store"
import type { Notification } from "@/types/models.types"
import { cn } from "@/lib/utils"

export function InAppNotification() {
  const notifications = useNotificationStore((state) => state.notifications)
  const [visibleNotification, setVisibleNotification] = useState<Notification | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Watch for new unread notifications
  useEffect(() => {
    const unreadNotifications = notifications.filter((n) => !n.read)
    if (unreadNotifications.length > 0) {
      const latestNotification = unreadNotifications[0]
      // Only show if it's a recent notification (within last 5 seconds)
      const notificationTime = new Date(latestNotification.createdAt).getTime()
      const now = Date.now()
      if (now - notificationTime < 5000) {
        setVisibleNotification(latestNotification)
        setIsVisible(true)

        // Auto-hide after 4 seconds
        const timer = setTimeout(() => {
          setIsVisible(false)
        }, 4000)

        return () => clearTimeout(timer)
      }
    }
  }, [notifications])

  const handleDismiss = () => {
    setIsVisible(false)
  }

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "task_assigned":
        return <ClipboardList className="h-5 w-5" />
      case "task_updated":
      case "task_completed":
        return <CheckCheck className="h-5 w-5" />
      case "comment":
        return <MessageSquare className="h-5 w-5" />
      case "reminder":
        return <Clock className="h-5 w-5" />
      default:
        return <Bell className="h-5 w-5" />
    }
  }

  const getNotificationColor = (type: Notification["type"]) => {
    switch (type) {
      case "task_assigned":
        return "bg-blue-500"
      case "task_completed":
        return "bg-green-500"
      case "task_updated":
        return "bg-yellow-500"
      case "comment":
        return "bg-purple-500"
      case "reminder":
        return "bg-orange-500"
      default:
        return "bg-gray-500"
    }
  }

  if (!visibleNotification || !isVisible) return null

  return (
    <div
      className={cn(
        "fixed top-4 left-4 right-4 z-[100] transition-all duration-300 ease-out",
        isVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
      )}
    >
      <div className="mx-auto max-w-md rounded-lg border border-border bg-background p-4 shadow-lg">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white",
              getNotificationColor(visibleNotification.type),
            )}
          >
            {getNotificationIcon(visibleNotification.type)}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm">{visibleNotification.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-2">{visibleNotification.message}</p>
          </div>
          <button onClick={handleDismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
