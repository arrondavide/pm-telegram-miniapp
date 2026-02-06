/**
 * Task data transformation utilities
 * Converts between database (snake_case) and frontend (camelCase) formats
 */

import type { Task, TaskAssignee } from "@/types/models.types"
import { userTransformer } from "./user.transformer"

interface DbTaskPopulatedUser {
  _id?: { toString(): string }
  telegram_id?: string
  full_name?: string
  username?: string
}

interface DbTaskAssignee {
  _id?: { toString(): string }
  telegram_id?: string
  full_name?: string
}

interface DbTask {
  _id: { toString(): string }
  title: string
  description?: string
  due_date: Date
  status: Task["status"]
  priority: Task["priority"]
  assigned_to: (DbTaskAssignee | { toString(): string } | string)[]
  created_by: DbTaskPopulatedUser | { toString(): string } | string
  company_id: { toString(): string } | string
  project_id: { toString(): string } | string
  parent_task_id?: { toString(): string } | string | null
  depth?: number
  path?: ({ toString(): string } | string)[]
  category?: string
  tags?: string[]
  department?: string
  estimated_hours?: number
  actual_hours?: number
  completed_at?: Date
  cancelled_at?: Date
  createdAt: Date
  updatedAt?: Date
}

export const taskTransformer = {
  /**
   * Transform database task document to frontend format
   */
  toFrontend(doc: DbTask): Task {
    const companyId = typeof doc.company_id === "string" ? doc.company_id : doc.company_id.toString()
    const projectId = typeof doc.project_id === "string" ? doc.project_id : doc.project_id.toString()

    // Handle parent_task_id
    let parentTaskId: string | null = null
    if (doc.parent_task_id) {
      parentTaskId =
        typeof doc.parent_task_id === "string" ? doc.parent_task_id : doc.parent_task_id.toString()
    }

    // Handle created_by
    let createdBy: Task["createdBy"]
    if (typeof doc.created_by === "string") {
      createdBy = doc.created_by
    } else if (doc.created_by && typeof doc.created_by === "object" && "_id" in doc.created_by) {
      createdBy = userTransformer.toSummary(doc.created_by as DbTaskPopulatedUser)
    } else if (doc.created_by && typeof (doc.created_by as { toString(): string }).toString === "function") {
      createdBy = (doc.created_by as { toString(): string }).toString()
    } else {
      createdBy = ""
    }

    // Handle assigned_to array - normalize to consistent format
    // IMPORTANT: Always include telegramId as string (even empty) for frontend matching
    const assignedTo: (string | TaskAssignee)[] = (doc.assigned_to || []).map((assignee) => {
      if (typeof assignee === "string") {
        return assignee
      }
      if (assignee && typeof assignee === "object" && "_id" in assignee) {
        const a = assignee as DbTaskAssignee
        return {
          id: a._id?.toString() || "",
          telegramId: a.telegram_id?.toString() || "",
          fullName: a.full_name || "",
        }
      }
      if (assignee && typeof (assignee as { toString(): string }).toString === "function") {
        return (assignee as { toString(): string }).toString()
      }
      return ""
    })

    // Handle path array
    const path = (doc.path || []).map((p) => (typeof p === "string" ? p : p.toString()))

    return {
      id: doc._id.toString(),
      title: doc.title,
      description: doc.description || "",
      dueDate: doc.due_date.toISOString(),
      status: doc.status,
      priority: doc.priority,
      assignedTo,
      createdBy,
      companyId,
      projectId,
      parentTaskId,
      depth: doc.depth ?? 0,
      path,
      category: doc.category || "",
      tags: doc.tags || [],
      department: doc.department || "",
      estimatedHours: doc.estimated_hours ?? 0,
      actualHours: doc.actual_hours ?? 0,
      completedAt: doc.completed_at?.toISOString() || null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt?.toISOString(),
    }
  },

  /**
   * Transform frontend task data to database format
   */
  toDatabase(data: Partial<Task>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    if (data.title !== undefined) result.title = data.title
    if (data.description !== undefined) result.description = data.description
    if (data.dueDate !== undefined) result.due_date = new Date(data.dueDate)
    if (data.status !== undefined) result.status = data.status
    if (data.priority !== undefined) result.priority = data.priority
    if (data.companyId !== undefined) result.company_id = data.companyId
    if (data.projectId !== undefined) result.project_id = data.projectId
    if (data.parentTaskId !== undefined) result.parent_task_id = data.parentTaskId
    if (data.depth !== undefined) result.depth = data.depth
    if (data.path !== undefined) result.path = data.path
    if (data.category !== undefined) result.category = data.category
    if (data.tags !== undefined) result.tags = data.tags
    if (data.department !== undefined) result.department = data.department
    if (data.estimatedHours !== undefined) result.estimated_hours = data.estimatedHours
    if (data.actualHours !== undefined) result.actual_hours = data.actualHours

    // Handle assignedTo - extract IDs for database storage
    if (data.assignedTo !== undefined) {
      result.assigned_to = data.assignedTo.map((a) => {
        if (typeof a === "string") return a
        return a.id
      })
    }

    return result
  },

  /**
   * Transform array of tasks
   */
  toList(docs: DbTask[]): Task[] {
    return docs.map((doc) => this.toFrontend(doc))
  },
}
