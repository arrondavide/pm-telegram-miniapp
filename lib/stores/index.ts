/**
 * Modular Zustand stores - centralized exports
 *
 * This replaces the monolithic store.ts with modular, feature-based stores.
 * Each store manages its own domain and can be used independently or combined.
 */

// Individual store exports
export { useUserStore } from "./user.store"
export { useCompanyStore } from "./company.store"
export { useProjectStore } from "./project.store"
export { useTaskStore } from "./task.store"
export { useTimeStore } from "./time.store"
export { useNotificationStore } from "./notification.store"
export { useCommentStore } from "./comment.store"

// Re-export types for convenience
export type { User, UserCompany, UserSummary } from "@/types/models.types"
export type { Company } from "@/types/models.types"
export type { Project } from "@/types/models.types"
export type { Task, TaskStatus, TaskPriority, TaskAssignee } from "@/types/models.types"
export type { TimeLog } from "@/types/models.types"
export type { Notification, NotificationType } from "@/types/models.types"
export type { Comment } from "@/types/models.types"
export type { Invitation } from "@/types/models.types"

/**
 * Combined store hook for components that need access to multiple stores.
 *
 * Usage:
 * ```tsx
 * const { user, company, project, task } = useStores()
 * ```
 */
import { useUserStore } from "./user.store"
import { useCompanyStore } from "./company.store"
import { useProjectStore } from "./project.store"
import { useTaskStore } from "./task.store"
import { useTimeStore } from "./time.store"
import { useNotificationStore } from "./notification.store"
import { useCommentStore } from "./comment.store"

export function useStores() {
  return {
    user: useUserStore(),
    company: useCompanyStore(),
    project: useProjectStore(),
    task: useTaskStore(),
    time: useTimeStore(),
    notification: useNotificationStore(),
    comment: useCommentStore(),
  }
}

/**
 * Statistics helpers that work across multiple stores
 */
export function useStatistics() {
  const userStore = useUserStore()
  const taskStore = useTaskStore()
  const timeStore = useTimeStore()

  const currentUser = userStore.currentUser
  const tasks = taskStore.tasks
  const timeLogs = timeStore.timeLogs

  const getPersonalStats = () => {
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
      (t) => t.companyId === currentUser.activeCompanyId && t.assignedTo.some((a) => {
        if (typeof a === "string") return a === currentUser.id
        return a.id === currentUser.id
      })
    )

    const completedTasks = userTasks.filter((t) => t.status === "completed").length
    const pendingTasks = userTasks.filter((t) => !["completed", "cancelled"].includes(t.status)).length
    const overdueTasks = userTasks.filter(
      (t) => !["completed", "cancelled"].includes(t.status) && new Date(t.dueDate) < new Date()
    ).length

    const userTimeLogs = timeLogs.filter((tl) => tl.userId === currentUser.id && tl.endTime)
    const totalSeconds = userTimeLogs.reduce((acc, tl) => acc + (tl.durationSeconds || 0), 0)

    return {
      totalTasks: userTasks.length,
      completedTasks,
      pendingTasks,
      overdueTasks,
      totalHoursWorked: isNaN(totalSeconds) ? 0 : Math.round((totalSeconds / 3600) * 10) / 10,
      completionRate: userTasks.length > 0 ? Math.round((completedTasks / userTasks.length) * 100) : 0,
    }
  }

  const getTeamStats = () => {
    const companyStore = useCompanyStore.getState()

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
      (t) => !["completed", "cancelled"].includes(t.status) && new Date(t.dueDate) < new Date()
    ).length

    const users = useUserStore.getState().users
    const companyMembers = users.filter((u) =>
      u.companies.some((c) => c.companyId === currentUser.activeCompanyId)
    )

    const performerStats = companyMembers
      .map((user) => ({
        user,
        completedCount: companyTasks.filter((t) =>
          t.status === "completed" && t.assignedTo.some((a) => {
            if (typeof a === "string") return a === user.id
            return a.id === user.id
          })
        ).length,
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
  }

  return {
    getPersonalStats,
    getTeamStats,
  }
}
