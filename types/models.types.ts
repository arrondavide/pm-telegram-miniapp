/**
 * Centralized type definitions for domain models
 * These types represent the frontend data format (camelCase)
 */

// User types
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

export interface UserSummary {
  id: string
  fullName: string
  username: string
  telegramId: string
}

// Company types
export interface Company {
  id: string
  name: string
  createdBy: string
  createdAt: Date
}

// Project types
export interface Project {
  id: string
  name: string
  description: string
  companyId: string
  status: "active" | "on_hold" | "completed" | "archived"
  createdBy: string | UserSummary
  color: string
  icon: string
  startDate: string | null
  targetEndDate: string | null
  completedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

// Task types
export type TaskStatus = "pending" | "started" | "in_progress" | "completed" | "blocked" | "cancelled"
export type TaskPriority = "low" | "medium" | "high" | "urgent"

export interface TaskAssignee {
  id: string
  telegramId?: string
  fullName?: string
}

export interface CustomFieldValue {
  fieldId: string
  value: any
}

export interface Task {
  id: string
  title: string
  description: string
  dueDate: string
  startDate?: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo: (string | TaskAssignee)[]
  createdBy: string | UserSummary
  companyId: string
  projectId: string
  parentTaskId: string | null
  depth: number
  path: string[]
  category: string
  tags: string[]
  department: string
  estimatedHours: number
  actualHours: number
  completedAt: string | null
  createdAt: string
  updatedAt?: string
  customFields?: CustomFieldValue[]

  // Recurring task config
  recurring?: {
    enabled: boolean
    pattern: string // Serialized RecurrencePattern
    lastCreated?: string
    nextDue?: string
    instanceCount: number
  }

  // Dependencies
  blockedBy?: string[]  // Task IDs that block this task
  blocking?: string[]   // Task IDs this task blocks
}

// Time tracking types
export interface TimeLog {
  id: string
  taskId: string
  userId: string
  userName: string
  userTelegramId?: string
  startTime: string
  endTime: string | null
  durationMinutes: number
  durationSeconds: number
  note: string
}

// Comment types
export interface Comment {
  id: string
  taskId: string
  userId: string
  userName?: string
  message: string
  mentions?: Mention[]
  createdAt: string
  updatedAt?: string
  parentCommentId?: string // For threaded comments
}

// Invitation types
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
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
}

// Mention types
export interface Mention {
  userId: string
  username: string
  startIndex: number
  endIndex: number
}

// Notification types
export type NotificationType =
  | "task_assigned"
  | "task_updated"
  | "task_completed"
  | "comment"
  | "mention"
  | "reminder"
  | "dependency_resolved"
  | "recurring_created"
  | "general"

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  taskId?: string
  read: boolean
  createdAt: string
}

// Statistics types
export interface PersonalStats {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  totalHoursWorked: number
  completionRate: number
}

export interface TeamStats {
  totalTasks: number
  completedTasks: number
  pendingTasks: number
  overdueTasks: number
  completionRate: number
  totalMembers: number
  topPerformers: Array<{ user: User; completedCount: number }>
}
