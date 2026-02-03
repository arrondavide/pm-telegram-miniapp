/**
 * Notification store - handles in-app notifications
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Notification, NotificationType } from "@/types/models.types"

interface NotificationState {
  notifications: Notification[]
}

interface NotificationActions {
  loadNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Omit<Notification, "id" | "read" | "createdAt">) => void
  markNotificationRead: (notificationId: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  getUnreadNotificationCount: () => number
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  persist(
    (set, get) => ({
      notifications: [],

      loadNotifications: (notifications) => {
        set({ notifications })
      },

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          notifications: [newNotification, ...state.notifications].slice(0, 50), // Keep last 50
        }))
      },

      markNotificationRead: (notificationId) => {
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
        }))
      },

      markAllNotificationsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
        }))
      },

      clearNotifications: () => {
        set({ notifications: [] })
      },

      getUnreadNotificationCount: () => {
        return get().notifications.filter((n) => !n.read).length
      },
    }),
    {
      name: "notification-store",
      partialize: (state) => ({
        notifications: state.notifications,
      }),
    }
  )
)
