import { create } from "zustand"
import { persist } from "zustand/middleware"

// Types
export interface Company {
  id: string
  name: string
  createdBy: string
  createdAt: Date
}

export interface UserCompany {
  companyId: string
  role: "admin" | "manager" | "employee"
  department: string
  joinedAt: Date
}

export interface User {
  id: string
  telegramId: string
  fullName: string
  username: string
  companies: UserCompany[]
  activeCompanyId: string | null
  preferences: {
    dailyDigest: boolean
    reminderTime: string
  }
  createdAt: Date
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
  completedAt: Date | null
}

export interface Task {
  id: string
  title: string
  description: string
  dueDate: Date
  status: "pending" | "started" | "in_progress" | "completed" | "blocked" | "cancelled"
  priority: "low" | "medium" | "high" | "urgent"
  assignedTo: string[]
  createdBy: string
  companyId: string
  category: string
  tags: string[]
  department: string
  subtasks: Subtask[]
  estimatedHours: number
  actualHours: number
  completedAt: Date | null
  createdAt: Date
}

export interface TimeLog {
  id: string
  taskId: string
  userId: string
  startTime: Date
  endTime: Date | null
  durationMinutes: number
  note: string
}

export interface Comment {
  id: string
  taskId: string
  userId: string
  message: string
  createdAt: Date
}

export interface Invitation {
  id: string
  companyId: string
  invitedBy: string
  username: string
  telegramId: string | null
  role: "admin" | "manager" | "employee"
  department: string
  status: "pending" | "accepted" | "rejected" | "expired"
  invitationCode: string
  expiresAt: Date
  acceptedAt: Date | null
  createdAt: Date
}

export interface Notification {
  id: string
  type: "task_assigned" | "task_updated" | "task_completed" | "comment" | "reminder" | "general"
  title: string
  message: string
  taskId?: string
  read: boolean
  createdAt: Date
}

interface AppState {
  // Data
  users: User[]
  companies: Company[]
  tasks: Task[]
  timeLogs: TimeLog[]
  comments: Comment[]
  invitations: Invitation[]
  currentUser: User | null
  activeTimeLog: TimeLog | null
  notifications: Notification[]

  // Actions
  initialize: () => void
  setCurrentUser: (user: User | null) => void
  setCompanies: (companies: Company[]) => void
  getUserByTelegramId: (telegramId: string) => User | null
  loadTasks: (tasks: Task[]) => void
  addNotification: (notification: Omit<Notification, "id" | "read" | "createdAt">) => void
  markNotificationRead: (notificationId: string) => void
  markAllNotificationsRead: () => void
  clearNotifications: () => void
  getUnreadNotificationCount: () => number

  // Company actions
  createCompany: (name: string, creatorTelegramId: string, creatorName: string, creatorUsername: string) => Company
  switchCompany: (companyId: string) => void
  getActiveCompany: () => Company | null
  deleteCompany: (companyId: string) => void
  joinCompanyWithCode: (company: Company, userCompany: UserCompany) => void

  // User actions
  registerUser: (telegramId: string, fullName: string, username: string) => User
  getUserRole: () => "admin" | "manager" | "employee" | null

  // Task actions
  createTask: (task: Omit<Task, "id" | "createdAt" | "completedAt" | "actualHours">) => Task
  updateTask: (taskId: string, updates: Partial<Task>) => void
  updateTaskStatus: (taskId: string, status: Task["status"]) => void
  getTasksForUser: () => Task[]
  getAllCompanyTasks: () => Task[]
  getTaskById: (taskId: string) => Task | null
  toggleSubtask: (taskId: string, subtaskId: string) => void

  // Time tracking
  clockIn: (taskId: string) => void
  clockOut: (note?: string) => TimeLog | null
  getActiveTimeLog: () => TimeLog | null
  getTimeLogsForTask: (taskId: string) => TimeLog[]

  // Comments
  addComment: (taskId: string, message: string) => Comment
  getCommentsForTask: (taskId: string) => Comment[]

  // Team management
  getCompanyMembers: () => User[]
  loadMembers: (members: User[]) => void
  inviteEmployee: (username: string, role: "admin" | "manager" | "employee", department: string) => Invitation
  addInvitation: (invitation: Invitation) => void
  acceptInvitation: (invitationCode: string) => boolean
  changeUserRole: (userId: string, newRole: "admin" | "manager" | "employee") => void
  getPendingInvitations: () => Invitation[]
  deleteInvitation: (invitationId: string) => void

  // Statistics
  getPersonalStats: () => {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    overdueTasks: number
    totalHoursWorked: number
    completionRate: number
  }
  getTeamStats: () => {
    totalTasks: number
    completedTasks: number
    pendingTasks: number
    overdueTasks: number
    completionRate: number
    topPerformers: Array<{ user: User; completedCount: number }>
  }
}

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15)
const generateInviteCode = () => Math.random().toString(36).substring(2, 10).toUpperCase()

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      users: [],
      companies: [],
      tasks: [],
      timeLogs: [],
      comments: [],
      invitations: [],
      currentUser: null,
      activeTimeLog: null,
      notifications: [],

      initialize: () => {
        // Demo data only loads if no companies exist and user creates one locally
      },

      setCurrentUser: (user) => set({ currentUser: user }),

      setCompanies: (companies) => set({ companies }),

      getUserByTelegramId: (telegramId) => {
        return get().users.find((u) => u.telegramId === telegramId) || null
      },

      loadTasks: (tasks) => {
        set((state) => {
          const existingTaskIds = new Set(state.tasks.map((t) => t.id))
          const apiTaskIds = new Set(tasks.map((t) => t.id))

          // Keep local tasks that don't exist in API (newly created)
          const localOnlyTasks = state.tasks.filter((t) => !apiTaskIds.has(t.id))

          // Merge API tasks with local only tasks
          return {
            tasks: [...tasks, ...localOnlyTasks],
          }
        })
      },

      addNotification: (notification) => {
        const newNotification: Notification = {
          ...notification,
          id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          read: false,
          createdAt: new Date(),
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

      createCompany: (name, creatorTelegramId, creatorName, creatorUsername) => {
        const companyId = generateId()
        const userId = generateId()

        const company: Company = {
          id: companyId,
          name,
          createdBy: userId,
          createdAt: new Date(),
        }

        const existingUser = get().getUserByTelegramId(creatorTelegramId)

        let user: User
        if (existingUser) {
          user = {
            ...existingUser,
            companies: [
              ...existingUser.companies,
              {
                companyId,
                role: "admin",
                department: "",
                joinedAt: new Date(),
              },
            ],
            activeCompanyId: companyId,
          }
          set((state) => ({
            companies: [...state.companies, company],
            users: state.users.map((u) => (u.telegramId === creatorTelegramId ? user : u)),
            currentUser: user,
          }))
        } else {
          user = {
            id: userId,
            telegramId: creatorTelegramId,
            fullName: creatorName,
            username: creatorUsername,
            companies: [
              {
                companyId,
                role: "admin",
                department: "",
                joinedAt: new Date(),
              },
            ],
            activeCompanyId: companyId,
            preferences: { dailyDigest: true, reminderTime: "09:00" },
            createdAt: new Date(),
          }
          set((state) => ({
            companies: [...state.companies, company],
            users: [...state.users, user],
            currentUser: user,
          }))
        }

        return company
      },

      switchCompany: (companyId) => {
        const { currentUser } = get()
        if (!currentUser) return

        const hasAccess = currentUser.companies.some((c) => c.companyId === companyId)
        if (!hasAccess) return

        const updatedUser = { ...currentUser, activeCompanyId: companyId }
        set((state) => ({
          currentUser: updatedUser,
          users: state.users.map((u) => (u.id === currentUser.id ? updatedUser : u)),
        }))
      },

      getActiveCompany: () => {
        const { currentUser, companies } = get()
        if (!currentUser?.activeCompanyId) return null
        return companies.find((c) => c.id === currentUser.activeCompanyId) || null
      },

      deleteCompany: (companyId: string) => {
        const { currentUser } = get()
        if (!currentUser) return

        // Remove company from user's companies
        const updatedCompanies = currentUser.companies.filter((c) => c.companyId !== companyId)

        // Set new active company
        const newActiveCompanyId = updatedCompanies.length > 0 ? updatedCompanies[0].companyId : null

        const updatedUser = {
          ...currentUser,
          companies: updatedCompanies,
          activeCompanyId: newActiveCompanyId,
        }

        set((state) => ({
          companies: state.companies.filter((c) => c.id !== companyId),
          tasks: state.tasks.filter((t) => t.companyId !== companyId),
          invitations: state.invitations.filter((i) => i.companyId !== companyId),
          currentUser: updatedUser,
          users: state.users.map((u) => (u.id === currentUser.id ? updatedUser : u)),
        }))
      },

      joinCompanyWithCode: (company: Company, userCompany: UserCompany) => {
        const { currentUser } = get()
        if (!currentUser) return

        // Check if company already exists in state
        const companyExists = get().companies.some((c) => c.id === company.id)

        const updatedUser = {
          ...currentUser,
          companies: [...currentUser.companies, userCompany],
          activeCompanyId: company.id,
        }

        set((state) => ({
          companies: companyExists ? state.companies : [...state.companies, company],
          currentUser: updatedUser,
          users: state.users.map((u) => (u.id === currentUser.id ? updatedUser : u)),
        }))
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

      getUserRole: () => {
        const { currentUser } = get()
        if (!currentUser?.activeCompanyId) return null
        const company = currentUser.companies.find((c) => c.companyId === currentUser.activeCompanyId)
        return company?.role || null
      },

      createTask: (taskData) => {
        const task: Task = {
          ...taskData,
          id: generateId(),
          actualHours: 0,
          completedAt: null,
          createdAt: new Date(),
        }

        set((state) => ({
          tasks: [...state.tasks, task],
        }))

        return task
      },

      updateTask: (taskId, updates) => {
        set((state) => ({
          tasks: state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        }))
      },

      updateTaskStatus: (taskId, status) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status,
                  completedAt: status === "completed" ? new Date() : t.completedAt,
                }
              : t,
          ),
        }))
      },

      getTasksForUser: () => {
        const { currentUser, tasks } = get()
        if (!currentUser?.activeCompanyId) return []

        return tasks
          .filter((t) => t.companyId === currentUser.activeCompanyId && t.assignedTo.includes(currentUser.id))
          .sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
            return (
              priorityOrder[a.priority] - priorityOrder[b.priority] ||
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            )
          })
      },

      getAllCompanyTasks: () => {
        const { currentUser, tasks } = get()
        if (!currentUser?.activeCompanyId) return []

        return tasks
          .filter((t) => t.companyId === currentUser.activeCompanyId)
          .sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
            return (
              priorityOrder[a.priority] - priorityOrder[b.priority] ||
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            )
          })
      },

      getTaskById: (taskId) => {
        return get().tasks.find((t) => t.id === taskId) || null
      },

      toggleSubtask: (taskId, subtaskId) => {
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  subtasks: t.subtasks.map((st) =>
                    st.id === subtaskId
                      ? {
                          ...st,
                          completed: !st.completed,
                          completedAt: !st.completed ? new Date() : null,
                        }
                      : st,
                  ),
                }
              : t,
          ),
        }))
      },

      clockIn: (taskId) => {
        const { currentUser, activeTimeLog } = get()
        if (!currentUser || activeTimeLog) return

        const timeLog: TimeLog = {
          id: generateId(),
          taskId,
          userId: currentUser.id,
          startTime: new Date(),
          endTime: null,
          durationMinutes: 0,
          note: "",
        }

        set((state) => ({
          timeLogs: [...state.timeLogs, timeLog],
          activeTimeLog: timeLog,
        }))

        // Update task status if pending
        const task = get().tasks.find((t) => t.id === taskId)
        if (task?.status === "pending") {
          get().updateTaskStatus(taskId, "started")
        }
      },

      clockOut: (note = "") => {
        const { activeTimeLog } = get()
        if (!activeTimeLog) return null

        const endTime = new Date()
        const durationMinutes = Math.round(
          (endTime.getTime() - new Date(activeTimeLog.startTime).getTime()) / 1000 / 60,
        )

        const updatedLog: TimeLog = {
          ...activeTimeLog,
          endTime,
          durationMinutes,
          note,
        }

        set((state) => ({
          timeLogs: state.timeLogs.map((tl) => (tl.id === activeTimeLog.id ? updatedLog : tl)),
          activeTimeLog: null,
          tasks: state.tasks.map((t) =>
            t.id === activeTimeLog.taskId ? { ...t, actualHours: t.actualHours + durationMinutes / 60 } : t,
          ),
        }))

        return updatedLog
      },

      getActiveTimeLog: () => get().activeTimeLog,

      getTimeLogsForTask: (taskId) => {
        return get().timeLogs.filter((tl) => tl.taskId === taskId)
      },

      addComment: (taskId, message) => {
        const { currentUser } = get()
        if (!currentUser) throw new Error("No user logged in")

        const comment: Comment = {
          id: generateId(),
          taskId,
          userId: currentUser.id,
          message,
          createdAt: new Date(),
        }

        set((state) => ({
          comments: [...state.comments, comment],
        }))

        return comment
      },

      getCommentsForTask: (taskId) => {
        return get()
          .comments.filter((c) => c.taskId === taskId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      },

      getCompanyMembers: () => {
        const { currentUser, users } = get()
        if (!currentUser?.activeCompanyId) return []

        return users.filter((u) => u.companies.some((c) => c.companyId === currentUser.activeCompanyId))
      },

      loadMembers: (members: User[]) => {
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

      inviteEmployee: (username, role, department) => {
        const { currentUser } = get()
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
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          acceptedAt: null,
          createdAt: new Date(),
        }

        set((state) => ({
          invitations: [...state.invitations, invitation],
        }))

        return invitation
      },

      addInvitation: (invitation: Invitation) => {
        set((state) => ({
          invitations: [...state.invitations, invitation],
        }))
      },

      acceptInvitation: (invitationCode) => {
        const { currentUser, invitations } = get()
        if (!currentUser) return false

        const invitation = invitations.find(
          (i) => i.invitationCode === invitationCode && i.status === "pending" && new Date(i.expiresAt) > new Date(),
        )

        if (!invitation) return false

        // Add company to user
        const updatedUser: User = {
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

        set((state) => ({
          currentUser: updatedUser,
          users: state.users.map((u) => (u.id === currentUser.id ? updatedUser : u)),
          invitations: state.invitations.map((i) =>
            i.id === invitation.id
              ? {
                  ...i,
                  status: "accepted" as const,
                  telegramId: currentUser.telegramId,
                  acceptedAt: new Date(),
                }
              : i,
          ),
        }))

        return true
      },

      changeUserRole: (userId, newRole) => {
        const { currentUser } = get()
        if (!currentUser?.activeCompanyId) return

        set((state) => ({
          users: state.users.map((u) =>
            u.id === userId
              ? {
                  ...u,
                  companies: u.companies.map((c) =>
                    c.companyId === currentUser.activeCompanyId ? { ...c, role: newRole } : c,
                  ),
                }
              : u,
          ),
        }))
      },

      getPendingInvitations: () => {
        const { currentUser, invitations } = get()
        if (!currentUser?.activeCompanyId) return []

        return invitations.filter(
          (i) =>
            i.companyId === currentUser.activeCompanyId && i.status === "pending" && new Date(i.expiresAt) > new Date(),
        )
      },

      deleteInvitation: (invitationId: string) => {
        set((state) => ({
          invitations: state.invitations.filter((i) => i.id !== invitationId),
        }))
      },

      getPersonalStats: () => {
        const { currentUser, tasks, timeLogs } = get()
        if (!currentUser?.activeCompanyId) {
          return {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            totalHoursWorked: 0,
            completionRate: 0,
          }
        }

        const userTasks = tasks.filter(
          (t) => t.companyId === currentUser.activeCompanyId && t.assignedTo.includes(currentUser.id),
        )

        const completedTasks = userTasks.filter((t) => t.status === "completed").length
        const pendingTasks = userTasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length
        const overdueTasks = userTasks.filter(
          (t) => !["completed", "cancelled"].includes(t.status) && new Date(t.dueDate) < new Date(),
        ).length

        const userTimeLogs = timeLogs.filter((tl) => tl.userId === currentUser.id && tl.endTime)
        const totalMinutes = userTimeLogs.reduce((acc, tl) => acc + tl.durationMinutes, 0)

        return {
          totalTasks: userTasks.length,
          completedTasks,
          pendingTasks,
          overdueTasks,
          totalHoursWorked: Math.round((totalMinutes / 60) * 10) / 10,
          completionRate: userTasks.length > 0 ? Math.round((completedTasks / userTasks.length) * 100) : 0,
        }
      },

      getTeamStats: () => {
        const { currentUser, tasks, users } = get()
        if (!currentUser?.activeCompanyId) {
          return {
            totalTasks: 0,
            completedTasks: 0,
            pendingTasks: 0,
            overdueTasks: 0,
            completionRate: 0,
            topPerformers: [],
          }
        }

        const companyTasks = tasks.filter((t) => t.companyId === currentUser.activeCompanyId)
        const completedTasks = companyTasks.filter((t) => t.status === "completed").length
        const pendingTasks = companyTasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length
        const overdueTasks = companyTasks.filter(
          (t) => !["completed", "cancelled"].includes(t.status) && new Date(t.dueDate) < new Date(),
        ).length

        // Calculate top performers
        const companyMembers = users.filter((u) => u.companies.some((c) => c.companyId === currentUser.activeCompanyId))

        const performerStats = companyMembers
          .map((user) => ({
            user,
            completedCount: companyTasks.filter((t) => t.status === "completed" && t.assignedTo.includes(user.id))
              .length,
          }))
          .filter((p) => p.completedCount > 0)
          .sort((a, b) => b.completedCount - a.completedCount)
          .slice(0, 5)

        return {
          totalTasks: companyTasks.length,
          completedTasks,
          pendingTasks,
          overdueTasks,
          completionRate: companyTasks.length > 0 ? Math.round((completedTasks / companyTasks.length) * 100) : 0,
          topPerformers: performerStats,
        }
      },
    }),
    {
      name: "whatstask-storage",
      partialize: (state) => ({
        users: state.users,
        companies: state.companies,
        tasks: state.tasks,
        timeLogs: state.timeLogs,
        comments: state.comments,
        invitations: state.invitations,
        activeTimeLog: state.activeTimeLog,
        notifications: state.notifications,
        currentUser: state.currentUser,
      }),
    },
  ),
)
