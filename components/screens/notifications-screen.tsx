"use client"

import { useState, useEffect } from "react"
import { ArrowLeft, Bell, CheckCheck, Trash2, Clock, ClipboardList, MessageSquare, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useNotificationStore } from "@/lib/stores/notification.store"
import type { Notification } from "@/types/models.types"
import { useTelegram } from "@/hooks/use-telegram"
import { notificationApi } from "@/lib/api"
import { cn } from "@/lib/utils"
import Image from "next/image"

interface NotificationsScreenProps {
  onBack: () => void
  onTaskSelect?: (taskId: string) => void
}

export function NotificationsScreen({ onBack, onTaskSelect }: NotificationsScreenProps) {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
    addNotification,
  } = useNotificationStore()
  const { hapticFeedback, user } = useTelegram()
  const [filter, setFilter] = useState<"all" | "unread">("all")
  const [isLoading, setIsLoading] = useState(false)

  // Load notifications from API on mount
  useEffect(() => {
    if (user?.id) {
      loadNotificationsFromApi()
    }
  }, [user?.id])

  const loadNotificationsFromApi = async () => {
    if (!user?.id) return
    setIsLoading(true)
    try {
      const response = await notificationApi.getAll(user.id.toString())
      if (response.success && response.data?.notifications) {
        // Merge API notifications with local ones
        response.data.notifications.forEach((n) => {
          addNotification({
            type: n.type as Notification["type"],
            title: n.title,
            message: n.message,
            taskId: n.taskId,
          })
        })
      }
    } catch (error) {
      
    } finally {
      setIsLoading(false)
    }
  }

  const filteredNotifications = filter === "unread" ? notifications.filter((n) => !n.read) : notifications

  const unreadCount = notifications.filter((n) => !n.read).length

  const handleNotificationClick = async (notification: Notification) => {
    hapticFeedback("light")
    markNotificationRead(notification.id)

    // Mark as read in API too
    try {
      await notificationApi.markRead(notification.id)
    } catch (error) {
      // Ignore API errors, local state is already updated
    }

    if (notification.taskId && onTaskSelect) {
      onTaskSelect(notification.taskId)
    }
  }

  const handleMarkAllRead = async () => {
    hapticFeedback("medium")
    markAllNotificationsRead()

    if (user?.id) {
      try {
        await notificationApi.markAllRead(user.id.toString())
      } catch (error) {
        // Ignore API errors
      }
    }
  }

  const handleClearAll = async () => {
    hapticFeedback("medium")
    clearNotifications()

    if (user?.id) {
      try {
        await notificationApi.clear(user.id.toString())
      } catch (error) {
        // Ignore API errors
      }
    }
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
        return "bg-blue-100 text-blue-600"
      case "task_completed":
        return "bg-green-100 text-green-600"
      case "task_updated":
        return "bg-yellow-100 text-yellow-600"
      case "comment":
        return "bg-purple-100 text-purple-600"
      case "reminder":
        return "bg-orange-100 text-orange-600"
      default:
        return "bg-gray-100 text-gray-600"
    }
  }

  const formatTime = (date: Date | string) => {
    const now = new Date()
    const diff = now.getTime() - new Date(date).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return "Just now"
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(date).toLocaleDateString()
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 border-b border-border/50 bg-background p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0" aria-label="Go back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground">
              <Image src="/logo-dark.png" alt="WhatsTask" width={20} height={20} className="invert" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold">Notifications</h1>
              {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} unread</p>}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={loadNotificationsFromApi}
            disabled={isLoading}
            className="ml-auto"
            aria-label="Refresh notifications"
          >
            <RefreshCw className={cn("h-5 w-5", isLoading && "animate-spin")} />
          </Button>
        </div>

        {/* Filter and Actions */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
              className={filter === "all" ? "bg-foreground text-background" : ""}
            >
              All
            </Button>
            <Button
              variant={filter === "unread" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("unread")}
              className={filter === "unread" ? "bg-foreground text-background" : ""}
            >
              Unread ({unreadCount})
            </Button>
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
                <CheckCheck className="mr-1 h-4 w-4" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Bell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-heading font-semibold">No notifications</h3>
            <p className="text-sm text-muted-foreground">
              {filter === "unread" ? "You're all caught up!" : "You'll see notifications here"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((notification) => (
              <Card
                key={notification.id}
                className={cn(
                  "cursor-pointer p-4 transition-all hover:bg-muted/50",
                  !notification.read && "border-l-4 border-l-[#040404] bg-muted/30",
                )}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                      getNotificationColor(notification.type),
                    )}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={cn("font-medium text-sm", !notification.read && "font-semibold")}>
                        {notification.title}
                      </h4>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{notification.message}</p>
                  </div>
                </div>
              </Card>
            ))}

            {notifications.length > 0 && (
              <Button variant="ghost" className="w-full mt-4 text-muted-foreground" onClick={handleClearAll}>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear all notifications
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
