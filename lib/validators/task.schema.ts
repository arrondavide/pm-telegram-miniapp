/**
 * Zod validation schemas for Task API requests
 */

import { z } from "zod"

// Task status and priority enums
export const taskStatusSchema = z.enum(["pending", "started", "in_progress", "completed", "blocked", "cancelled"])
export const taskPrioritySchema = z.enum(["low", "medium", "high", "urgent"])

// Create task input
export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be 200 characters or less"),
  description: z.string().max(2000, "Description must be 2000 characters or less").optional(),
  dueDate: z.string().datetime("Due date must be a valid ISO date"),
  priority: taskPrioritySchema.optional().default("medium"),
  assignedTo: z.array(z.string()).optional().default([]),
  companyId: z.string().min(1, "Company ID is required"),
  projectId: z.string().min(1, "Project ID is required"),
  parentTaskId: z.string().optional().nullable(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  department: z.string().max(50).optional(),
  estimatedHours: z.number().min(0).max(1000).optional().default(0),
})

// Update task input
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assignedTo: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  department: z.string().max(50).optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
  actualHours: z.number().min(0).optional(),
})

// Create subtask input
export const createSubtaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  dueDate: z.string().datetime().optional(),
  priority: taskPrioritySchema.optional().default("medium"),
  assignedTo: z.array(z.string()).optional(),
  category: z.string().max(50).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  department: z.string().max(50).optional(),
  estimatedHours: z.number().min(0).max(1000).optional(),
})

// Bulk operation input
export const bulkTaskMoveSchema = z.object({
  action: z.literal("move"),
  taskIds: z.array(z.string()).min(1, "At least one task ID is required"),
  targetProjectId: z.string().optional(),
  targetParentId: z.string().optional().nullable(),
})

// Query parameters for GET requests
export const getTasksQuerySchema = z.object({
  companyId: z.string().min(1, "Company ID is required"),
  projectId: z.string().optional(),
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assignedTo: z.string().optional(),
  rootOnly: z.coerce.boolean().optional().default(false),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
})

// Types
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type CreateSubtaskInput = z.infer<typeof createSubtaskSchema>
export type BulkTaskMoveInput = z.infer<typeof bulkTaskMoveSchema>
export type GetTasksQuery = z.infer<typeof getTasksQuerySchema>
