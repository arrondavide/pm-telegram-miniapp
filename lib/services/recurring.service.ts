/**
 * Recurring Task Service
 * Handles creation and management of recurring tasks
 */

import type { Task } from "@/types/models.types"
import {
  type RecurrencePattern,
  type RecurringTaskConfig,
  getNextOccurrence,
  shouldRecurrenceEnd,
  formatRecurrence,
} from "@/types/recurring.types"

/**
 * Create a new instance of a recurring task
 */
export function createRecurringInstance(
  template: Task,
  config: RecurringTaskConfig,
  pattern: RecurrencePattern
): Omit<Task, "id" | "createdAt"> | null {
  if (shouldRecurrenceEnd(config)) {
    return null
  }

  const nextDueDate = config.nextDue
    ? new Date(config.nextDue)
    : getNextOccurrence(pattern, new Date(template.dueDate))

  const newTask: Omit<Task, "id" | "createdAt"> = {
    title: template.title,
    description: config.copyDescription ? template.description : "",
    dueDate: nextDueDate.toISOString(),
    status: "pending",
    priority: template.priority,
    assignedTo: config.copyAssignees ? template.assignedTo : [],
    createdBy: template.createdBy,
    companyId: template.companyId,
    projectId: template.projectId,
    parentTaskId: template.parentTaskId,
    depth: template.depth,
    path: template.path,
    category: template.category,
    tags: config.copyTags ? template.tags : [],
    department: template.department,
    estimatedHours: template.estimatedHours,
    actualHours: 0,
    completedAt: null,
    customFields: config.copyCustomFields ? template.customFields : undefined,

    // Link to parent recurring task
    recurring: {
      enabled: true,
      pattern: JSON.stringify(pattern),
      lastCreated: new Date().toISOString(),
      nextDue: getNextOccurrence(pattern, nextDueDate).toISOString(),
      instanceCount: config.instanceCount + 1,
    },
  }

  return newTask
}

/**
 * Check which recurring tasks need new instances created
 */
export function getTasksDueForRecurrence(
  tasks: Task[],
  daysAhead: number = 1
): Task[] {
  const now = new Date()
  const threshold = new Date()
  threshold.setDate(threshold.getDate() + daysAhead)

  return tasks.filter((task) => {
    if (!task.recurring?.enabled) return false
    if (!task.recurring.nextDue) return false

    const nextDue = new Date(task.recurring.nextDue)
    return nextDue <= threshold
  })
}

/**
 * Parse stored pattern string back to object
 */
export function parseRecurrencePattern(patternString: string): RecurrencePattern | null {
  try {
    return JSON.parse(patternString)
  } catch {
    return null
  }
}

/**
 * Get human-readable recurrence summary
 */
export function getRecurrenceSummary(task: Task): string | null {
  if (!task.recurring?.enabled || !task.recurring.pattern) {
    return null
  }

  const pattern = parseRecurrencePattern(task.recurring.pattern)
  if (!pattern) return null

  return formatRecurrence(pattern)
}

/**
 * Default recurring config
 */
export function getDefaultRecurringConfig(): RecurringTaskConfig {
  return {
    enabled: false,
    pattern: {
      frequency: "weekly",
      interval: 1,
      endType: "never",
    },
    copyDescription: true,
    copyAssignees: true,
    copyTags: true,
    copyCustomFields: true,
    copySubtasks: false,
    createDaysBefore: 1,
    instanceCount: 0,
  }
}

/**
 * Calculate all upcoming occurrences for display
 */
export function getUpcomingOccurrences(
  pattern: RecurrencePattern,
  startDate: Date,
  count: number = 5
): Date[] {
  const occurrences: Date[] = []
  let current = startDate

  for (let i = 0; i < count; i++) {
    current = getNextOccurrence(pattern, current)
    occurrences.push(new Date(current))

    // Check if we've hit the end
    if (pattern.endType === "on_date" && pattern.endDate) {
      if (current >= new Date(pattern.endDate)) break
    }
  }

  return occurrences
}
