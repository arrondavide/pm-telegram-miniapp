/**
 * Task Dependencies Store
 * Manages task dependencies and blocking relationships
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { TaskDependency, DependencyType } from "@/types/dependencies.types"
import {
  detectCircularDependency,
  getBlockedTasks,
  getBlockingTasks,
  calculateEarliestStart,
} from "@/types/dependencies.types"

interface DependencyState {
  dependencies: TaskDependency[]
  isLoading: boolean
  error: string | null
}

interface DependencyActions {
  loadDependencies: (deps: TaskDependency[]) => void

  addDependency: (
    sourceTaskId: string,
    targetTaskId: string,
    type: DependencyType,
    lagDays: number,
    createdBy: string
  ) => { success: boolean; error?: string; circularPath?: string[] }

  removeDependency: (dependencyId: string) => void

  getDependenciesForTask: (taskId: string) => {
    blocking: TaskDependency[]
    blockedBy: TaskDependency[]
  }

  getBlockedTaskIds: (taskId: string) => string[]
  getBlockingTaskIds: (taskId: string) => string[]

  canAddDependency: (sourceTaskId: string, targetTaskId: string) => {
    valid: boolean
    error?: string
  }

  getEarliestStartDate: (
    taskId: string,
    taskDueDates: Map<string, Date>
  ) => Date | null

  clearDependencies: () => void
}

const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36)

export const useDependencyStore = create<DependencyState & DependencyActions>()(
  persist(
    (set, get) => ({
      dependencies: [],
      isLoading: false,
      error: null,

      loadDependencies: (deps) => {
        set({ dependencies: deps, isLoading: false, error: null })
      },

      addDependency: (sourceTaskId, targetTaskId, type, lagDays, createdBy) => {
        // Check for self-reference
        if (sourceTaskId === targetTaskId) {
          return { success: false, error: "A task cannot depend on itself" }
        }

        // Check for duplicate
        const existing = get().dependencies.find(
          (d) => d.sourceTaskId === sourceTaskId && d.targetTaskId === targetTaskId
        )
        if (existing) {
          return { success: false, error: "This dependency already exists" }
        }

        // Check for circular dependency
        const circularPath = detectCircularDependency(
          get().dependencies,
          sourceTaskId,
          targetTaskId
        )
        if (circularPath) {
          return {
            success: false,
            error: "This would create a circular dependency",
            circularPath,
          }
        }

        const dependency: TaskDependency = {
          id: generateId(),
          sourceTaskId,
          targetTaskId,
          type,
          lagDays,
          createdAt: new Date().toISOString(),
          createdBy,
        }

        set((state) => ({
          dependencies: [...state.dependencies, dependency],
        }))

        return { success: true }
      },

      removeDependency: (dependencyId) => {
        set((state) => ({
          dependencies: state.dependencies.filter((d) => d.id !== dependencyId),
        }))
      },

      getDependenciesForTask: (taskId) => {
        const deps = get().dependencies
        return {
          blocking: deps.filter((d) => d.sourceTaskId === taskId),
          blockedBy: deps.filter((d) => d.targetTaskId === taskId),
        }
      },

      getBlockedTaskIds: (taskId) => {
        return getBlockedTasks(taskId, get().dependencies)
      },

      getBlockingTaskIds: (taskId) => {
        return getBlockingTasks(taskId, get().dependencies)
      },

      canAddDependency: (sourceTaskId, targetTaskId) => {
        if (sourceTaskId === targetTaskId) {
          return { valid: false, error: "A task cannot depend on itself" }
        }

        const existing = get().dependencies.find(
          (d) => d.sourceTaskId === sourceTaskId && d.targetTaskId === targetTaskId
        )
        if (existing) {
          return { valid: false, error: "This dependency already exists" }
        }

        const circularPath = detectCircularDependency(
          get().dependencies,
          sourceTaskId,
          targetTaskId
        )
        if (circularPath) {
          return { valid: false, error: "This would create a circular dependency" }
        }

        return { valid: true }
      },

      getEarliestStartDate: (taskId, taskDueDates) => {
        return calculateEarliestStart(taskId, get().dependencies, taskDueDates)
      },

      clearDependencies: () => {
        set({ dependencies: [] })
      },
    }),
    {
      name: "dependency-store",
      partialize: (state) => ({
        dependencies: state.dependencies,
      }),
    }
  )
)
