"use client"

import { useState, useCallback } from "react"
import {
  parseNaturalLanguageTask,
  generateTaskSuggestions,
  generateDailyDigest,
  analyzeTask,
  generateProjectSummary,
  type ParsedTask,
  type TaskSuggestion,
  type DigestItem,
  type TaskInsights,
} from "@/lib/services/ai.service"
import type { Task } from "@/types/models.types"
import { useUserStore } from "@/lib/stores/user.store"
import { useTaskStore } from "@/lib/stores/task.store"

interface UseAIOptions {
  teamMembers?: Array<{ id: string; name: string; workload?: number; skills?: string[] }>
  existingTags?: string[]
  projectName?: string
  projectDeadline?: string
}

export function useAI(options: UseAIOptions = {}) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentUser = useUserStore((state) => state.currentUser)
  const tasks = useTaskStore((state) => state.tasks)

  // Parse natural language into a task
  const parseTask = useCallback(
    async (input: string): Promise<ParsedTask | null> => {
      setIsProcessing(true)
      setError(null)

      try {
        const parsed = await parseNaturalLanguageTask(input, {
          teamMembers: options.teamMembers,
          existingTags: options.existingTags,
          projectName: options.projectName,
        })
        return parsed
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse task")
        return null
      } finally {
        setIsProcessing(false)
      }
    },
    [options.teamMembers, options.existingTags, options.projectName]
  )

  // Get suggestions for a task
  const getSuggestions = useCallback(
    async (task: Partial<Task>): Promise<TaskSuggestion[]> => {
      setIsProcessing(true)
      setError(null)

      try {
        // Find similar tasks in the same project
        const similarTasks = tasks.filter(
          (t) =>
            t.projectId === task.projectId &&
            t.id !== task.id &&
            t.status === "completed"
        ).slice(0, 10)

        const suggestions = await generateTaskSuggestions(task, {
          teamMembers: options.teamMembers,
          similarTasks,
          projectDeadline: options.projectDeadline,
        })
        return suggestions
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate suggestions")
        return []
      } finally {
        setIsProcessing(false)
      }
    },
    [tasks, options.teamMembers, options.projectDeadline]
  )

  // Get daily digest
  const getDigest = useCallback((): DigestItem[] => {
    if (!currentUser) return []
    return generateDailyDigest(tasks, currentUser.id)
  }, [tasks, currentUser])

  // Analyze a task for risks
  const getTaskInsights = useCallback(
    async (
      task: Task,
      context?: {
        subtasks?: Task[]
        timeLogs?: Array<{ durationMinutes: number }>
      }
    ): Promise<TaskInsights> => {
      setIsProcessing(true)
      setError(null)

      try {
        // Get subtasks if not provided
        const subtasks = context?.subtasks || tasks.filter((t) => t.parentTaskId === task.id)

        // Calculate team workload
        const teamWorkload = new Map<string, number>()
        tasks.forEach((t) => {
          if (t.status !== "completed") {
            t.assignedTo.forEach((a) => {
              const id = typeof a === "string" ? a : a.id
              const current = teamWorkload.get(id) || 0
              teamWorkload.set(id, current + (t.estimatedHours || 2))
            })
          }
        })

        return analyzeTask(task, {
          subtasks,
          timeLogs: context?.timeLogs,
          teamWorkload,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze task")
        return {
          riskLevel: "low",
          riskFactors: [],
          recommendations: [],
        }
      } finally {
        setIsProcessing(false)
      }
    },
    [tasks]
  )

  // Generate project summary
  const getProjectSummary = useCallback(
    (projectId: string, projectName: string): string => {
      const projectTasks = tasks.filter((t) => t.projectId === projectId)
      return generateProjectSummary(projectName, projectTasks)
    },
    [tasks]
  )

  return {
    parseTask,
    getSuggestions,
    getDigest,
    getTaskInsights,
    getProjectSummary,
    isProcessing,
    error,
  }
}
