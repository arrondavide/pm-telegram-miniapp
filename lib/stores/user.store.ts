/**
 * User store - handles user authentication and profile state
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User, UserCompany } from "@/types/models.types"

interface UserState {
  currentUser: User | null
  users: User[]
}

interface UserActions {
  setCurrentUser: (user: User | null) => void
  getUserByTelegramId: (telegramId: string) => User | null
  registerUser: (telegramId: string, fullName: string, username: string) => User
  loadMembers: (members: User[]) => void
  getUserRole: () => "admin" | "manager" | "employee" | null
  updateUserCompany: (userId: string, companyId: string, updates: Partial<UserCompany>) => void
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useUserStore = create<UserState & UserActions>()(
  persist(
    (set, get) => ({
      currentUser: null,
      users: [],

      setCurrentUser: (user) => set({ currentUser: user }),

      getUserByTelegramId: (telegramId) => {
        return get().users.find((u) => u.telegramId === telegramId) || null
      },

      registerUser: (telegramId, fullName, username) => {
        const user: User = {
          id: generateId(),
          telegramId,
          fullName,
          username,
          companies: [],
          activeCompanyId: null,
          preferences: { dailyDigest: true, reminderTime: "09:00" },
          createdAt: new Date(),
        }

        set((state) => ({
          users: [...state.users, user],
          currentUser: user,
        }))

        return user
      },

      loadMembers: (members) => {
        set((state) => {
          const existingUserIds = new Set(state.users.map((u) => u.id))
          const newUsers = members.filter((m) => !existingUserIds.has(m.id))
          const updatedUsers = state.users.map((u) => {
            const apiUser = members.find((m) => m.id === u.id)
            return apiUser ? { ...u, ...apiUser } : u
          })
          return {
            users: [...updatedUsers, ...newUsers],
          }
        })
      },

      getUserRole: () => {
        const { currentUser } = get()
        if (!currentUser?.activeCompanyId) return null
        const company = currentUser.companies.find((c) => c.companyId === currentUser.activeCompanyId)
        return company?.role || null
      },

      updateUserCompany: (userId, companyId, updates) => {
        set((state) => ({
          users: state.users.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  companies: u.companies.map((c) => (c.companyId === companyId ? { ...c, ...updates } : c)),
                }
              : u
          ),
          currentUser:
            state.currentUser?.id === userId
              ? {
                  ...state.currentUser,
                  companies: state.currentUser.companies.map((c) =>
                    c.companyId === companyId ? { ...c, ...updates } : c
                  ),
                }
              : state.currentUser,
        }))
      },
    }),
    {
      name: "user-store",
      partialize: (state) => ({
        currentUser: state.currentUser,
        users: state.users,
      }),
    }
  )
)
