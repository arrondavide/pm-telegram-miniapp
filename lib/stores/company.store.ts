/**
 * Company store - handles company/workspace state
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Company, Invitation, UserCompany } from "@/types/models.types"
import { useUserStore } from "./user.store"

interface CompanyState {
  companies: Company[]
  invitations: Invitation[]
}

interface CompanyActions {
  setCompanies: (companies: Company[]) => void
  createCompany: (name: string, creatorTelegramId: string, creatorName: string, creatorUsername: string) => Company
  deleteCompany: (companyId: string) => void
  switchCompany: (companyId: string) => void
  getActiveCompany: () => Company | null
  joinCompanyWithCode: (company: Company, userCompany: UserCompany) => void

  // Invitation actions
  addInvitation: (invitation: Invitation) => void
  getPendingInvitations: () => Invitation[]
  deleteInvitation: (invitationId: string) => void
  acceptInvitation: (invitationCode: string) => boolean
  inviteEmployee: (username: string, role: "admin" | "manager" | "employee", department: string) => Invitation
}

const generateId = () => Math.random().toString(36).substring(2, 15)
const generateInviteCode = () => Math.random().toString(36).substring(2, 10).toUpperCase()

export const useCompanyStore = create<CompanyState & CompanyActions>()(
  persist(
    (set, get) => ({
      companies: [],
      invitations: [],

      setCompanies: (companies) => set({ companies }),

      createCompany: (name, creatorTelegramId, creatorName, creatorUsername) => {
        const userStore = useUserStore.getState()
        const companyId = generateId()
        const userId = generateId()

        const company: Company = {
          id: companyId,
          name,
          createdBy: userId,
          createdAt: new Date(),
        }

        const existingUser = userStore.getUserByTelegramId(creatorTelegramId)
        const userCompany: UserCompany = {
          companyId,
          role: "admin",
          department: "",
          joinedAt: new Date(),
        }

        if (existingUser) {
          const updatedUser = {
            ...existingUser,
            companies: [...existingUser.companies, userCompany],
            activeCompanyId: companyId,
          }
          userStore.setCurrentUser(updatedUser)
          userStore.loadMembers([updatedUser])
        } else {
          const newUser = {
            id: userId,
            telegramId: creatorTelegramId,
            fullName: creatorName,
            username: creatorUsername,
            companies: [userCompany],
            activeCompanyId: companyId,
            preferences: { dailyDigest: true, reminderTime: "09:00" },
            createdAt: new Date(),
          }
          userStore.setCurrentUser(newUser)
          userStore.loadMembers([newUser])
        }

        set((state) => ({
          companies: [...state.companies, company],
        }))

        return company
      },

      deleteCompany: (companyId) => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser) return

        const updatedCompanies = currentUser.companies.filter((c) => c.companyId !== companyId)
        const newActiveCompanyId = updatedCompanies.length > 0 ? updatedCompanies[0].companyId : null

        const updatedUser = {
          ...currentUser,
          companies: updatedCompanies,
          activeCompanyId: newActiveCompanyId,
        }

        userStore.setCurrentUser(updatedUser)
        userStore.loadMembers([updatedUser])

        set((state) => ({
          companies: state.companies.filter((c) => c.id !== companyId),
          invitations: state.invitations.filter((i) => i.companyId !== companyId),
        }))
      },

      switchCompany: (companyId) => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser) return

        const hasAccess = currentUser.companies.some((c) => c.companyId === companyId)
        if (!hasAccess) return

        const updatedUser = { ...currentUser, activeCompanyId: companyId }
        userStore.setCurrentUser(updatedUser)
        userStore.loadMembers([updatedUser])
      },

      getActiveCompany: () => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser?.activeCompanyId) return null
        return get().companies.find((c) => c.id === currentUser.activeCompanyId) || null
      },

      joinCompanyWithCode: (company, userCompany) => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser) return

        const companyExists = get().companies.some((c) => c.id === company.id)

        const updatedUser = {
          ...currentUser,
          companies: [...currentUser.companies, userCompany],
          activeCompanyId: company.id,
        }

        userStore.setCurrentUser(updatedUser)
        userStore.loadMembers([updatedUser])

        set((state) => ({
          companies: companyExists ? state.companies : [...state.companies, company],
        }))
      },

      addInvitation: (invitation) => {
        set((state) => ({
          invitations: [...state.invitations, invitation],
        }))
      },

      getPendingInvitations: () => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser?.activeCompanyId) return []

        return get().invitations.filter(
          (i) =>
            i.companyId === currentUser.activeCompanyId &&
            i.status === "pending" &&
            new Date(i.expiresAt) > new Date()
        )
      },

      deleteInvitation: (invitationId) => {
        set((state) => ({
          invitations: state.invitations.filter((i) => i.id !== invitationId),
        }))
      },

      acceptInvitation: (invitationCode) => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser) return false

        const invitation = get().invitations.find(
          (i) => i.invitationCode === invitationCode && i.status === "pending" && new Date(i.expiresAt) > new Date()
        )

        if (!invitation) return false

        const updatedUser = {
          ...currentUser,
          companies: [
            ...currentUser.companies,
            {
              companyId: invitation.companyId,
              role: invitation.role,
              department: invitation.department,
              joinedAt: new Date(),
            },
          ],
          activeCompanyId: invitation.companyId,
        }

        userStore.setCurrentUser(updatedUser)
        userStore.loadMembers([updatedUser])

        set((state) => ({
          invitations: state.invitations.map((i) =>
            i.id === invitation.id
              ? {
                  ...i,
                  status: "accepted" as const,
                  telegramId: currentUser.telegramId,
                  acceptedAt: new Date().toISOString(),
                }
              : i
          ),
        }))

        return true
      },

      inviteEmployee: (username, role, department) => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser?.activeCompanyId) throw new Error("No active company")

        const invitation: Invitation = {
          id: generateId(),
          companyId: currentUser.activeCompanyId,
          invitedBy: currentUser.id,
          username: username.replace("@", ""),
          telegramId: null,
          role,
          department,
          status: "pending",
          invitationCode: generateInviteCode(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          acceptedAt: null,
          createdAt: new Date().toISOString(),
        }

        set((state) => ({
          invitations: [...state.invitations, invitation],
        }))

        return invitation
      },
    }),
    {
      name: "company-store",
      partialize: (state) => ({
        companies: state.companies,
        invitations: state.invitations,
      }),
    }
  )
)
