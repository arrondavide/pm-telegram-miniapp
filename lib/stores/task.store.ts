/**
 * Task store - handles task state and operations
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Task, TaskAssignee } from "@/types/models.types"
import { useUserStore } from "./user.store"

interface TaskState {
  tasks: Task[]
  isLoading: boolean
  error: string | null
}

interface TaskActions {
  loadTasks: (tasks: Task[]) => void
  createTask: (task: Omit<Task, "id" | "createdAt" | "completedAt" | "actualHours">) => Task
  updateTask: (taskId: string, updates: Partial<Task>) => void
  updateTaskStatus: (taskId: string, status: Task["status"]) => void
  deleteTask: (taskId: string) => void
  getTaskById: (taskId: string) => Task | null
  getTasksForUser: () => Task[]
  getAllCompanyTasks: () => Task[]
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearTasks: () => void

  // Hierarchical task queries
  getTasksByProject: (projectId: string) => Task[]
  getRootTasksForProject: (projectId: string) => Task[]
  getTasksByParent: (parentTaskId: string) => Task[]
  getTaskPath: (taskId: string) => Task[]
  getSubtaskCount: (taskId: string) => number
  getCompletedSubtaskCount: (taskId: string) => number
}

const generateId = () => Math.random().toString(36).substring(2, 15)

export const useTaskStore = create<TaskState & TaskActions>()(
  persist(
    (set, get) => ({
      tasks: [],
      isLoading: false,
      error: null,

      loadTasks: (tasks) => {
        // Merge tasks instead of replacing to preserve locally-created tasks
        set((state) => {
          const taskMap = new Map(state.tasks.map((t) => [t.id, t]))
          tasks.forEach((task) => taskMap.set(task.id, task))
          return { tasks: Array.from(taskMap.values()), isLoading: false, error: null }
        })
      },

      createTask: (taskData) => {
        const task: Task = {
          ...taskData,
          id: generateId(),
          actualHours: 0,
          completedAt: null,
          createdAt: new Date().toISOString(),
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
                  completedAt: status === "completed" ? new Date().toISOString() : t.completedAt,
                }
              : t
          ),
        }))
      },

      deleteTask: (taskId) => {
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
        }))
      },

      getTaskById: (taskId) => {
        return get().tasks.find((t) => t.id === taskId) || null
      },

      getTasksForUser: () => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser?.activeCompanyId) {
          return []
        }

        // Use telegramId as the PRIMARY identifier since it's consistent
        // between local store and MongoDB (unlike id which can be random locally)
        const userTelegramId = currentUser.telegramId?.toString()

        const userTasks = get().tasks.filter((t) => {
          const companyMatch = t.companyId === currentUser.activeCompanyId
          if (!companyMatch) return false

          return t.assignedTo.some((assignee) => {
            // If assignee is a string, compare with telegramId
            if (typeof assignee === "string") {
              return assignee === userTelegramId
            }

            // If assignee is an object, check telegramId first (most reliable)
            if (typeof assignee === "object" && assignee !== null) {
              const a = assignee as TaskAssignee
              const assigneeTelegramId = a.telegramId?.toString()
              // Primary match: telegramId to telegramId
              return assigneeTelegramId === userTelegramId
            }
            return false
          })
        })

        // Sort by status, then priority, then due date
        return userTasks.sort((a, b) => {
          const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
          const statusOrder = { in_progress: 0, started: 1, pending: 2, blocked: 3, completed: 4, cancelled: 5 }

          if (statusOrder[a.status] !== statusOrder[b.status]) {
            return statusOrder[a.status] - statusOrder[b.status]
          }
          if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
            return priorityOrder[a.priority] - priorityOrder[b.priority]
          }
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
        })
      },

      getAllCompanyTasks: () => {
        const userStore = useUserStore.getState()
        const currentUser = userStore.currentUser

        if (!currentUser?.activeCompanyId) return []

        return get()
          .tasks.filter((t) => t.companyId === currentUser.activeCompanyId)
          .sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 }
            return (
              priorityOrder[a.priority] - priorityOrder[b.priority] ||
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
            )
          })
      },

      setLoading: (loading) => {
        set({ isLoading: loading })
      },

      setError: (error) => {
        set({ error, isLoading: false })
      },

      clearTasks: () => {
        set({ tasks: [] })
      },

      // Hierarchical task queries
      getTasksByProject: (projectId) => {
        return get().tasks.filter((t) => t.projectId === projectId)
      },

      getRootTasksForProject: (projectId) => {
        return get().tasks.filter((t) => t.projectId === projectId && (!t.parentTaskId || t.depth === 0))
      },

      getTasksByParent: (parentTaskId) => {
        return get().tasks.filter((t) => t.parentTaskId === parentTaskId)
      },

      getTaskPath: (taskId) => {
        const task = get().getTaskById(taskId)
        if (!task) return []

        const path: Task[] = []
        const tasks = get().tasks

        for (const pathId of task.path) {
          const ancestorTask = tasks.find((t) => t.id === pathId)
          if (ancestorTask) {
            path.push(ancestorTask)
          }
        }

        path.push(task)
        return path
      },

      getSubtaskCount: (taskId) => {
        return get().tasks.filter((t) => t.parentTaskId === taskId).length
      },

      getCompletedSubtaskCount: (taskId) => {
        return get().tasks.filter((t) => t.parentTaskId === taskId && t.status === "completed").length
      },
    }),
    {
      name: "task-store",
      partialize: (state) => ({
        tasks: state.tasks,
      }),
    }
  )
)
