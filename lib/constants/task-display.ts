/**
 * Shared display configuration for tasks
 * Used across Kanban, Calendar, Table, and Card views
 */

import type { TaskStatus, TaskPriority } from "@/types/models.types"

// Priority display configuration
export const priorityConfig: Record<TaskPriority, { color: string; label: string; indicator: string }> = {
  low: { color: "bg-muted-foreground/30", label: "Low", indicator: "L" },
  medium: { color: "bg-muted-foreground/50", label: "Medium", indicator: "M" },
  high: { color: "bg-orange-500", label: "High", indicator: "H" },
  urgent: { color: "bg-red-500", label: "Urgent", indicator: "!" },
}

// Status display configuration
export const statusConfig: Record<TaskStatus, { color: string; label: string }> = {
  pending: { color: "bg-muted-foreground/40", label: "Pending" },
  started: { color: "bg-muted-foreground/60", label: "Started" },
  in_progress: { color: "bg-blue-500", label: "In Progress" },
  completed: { color: "bg-green-500", label: "Completed" },
  blocked: { color: "bg-red-500", label: "Blocked" },
  cancelled: { color: "bg-gray-400", label: "Cancelled" },
}

// Priority sort order (for sorting tasks)
export const priorityOrder: Record<TaskPriority, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
}

// Status sort order (for sorting tasks)
export const statusOrder: Record<TaskStatus, number> = {
  blocked: 0,
  in_progress: 1,
  started: 2,
  pending: 3,
  completed: 4,
  cancelled: 5,
}

// Display limits
export const MAX_ASSIGNEES_DISPLAY = 3
export const MAX_TAGS_DISPLAY = 3
export const MAX_TASKS_WEEK_VIEW = 10
export const MAX_TASKS_MONTH_VIEW = 3

// Time constants
export const SEARCH_DEBOUNCE_MS = 150
export const COPY_FEEDBACK_TIMEOUT_MS = 2000
export const NOTIFICATION_AUTO_HIDE_MS = 4000
