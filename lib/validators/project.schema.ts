/**
 * Zod validation schemas for Project API requests
 */

import { z } from "zod"

// Project status enum
export const projectStatusSchema = z.enum(["active", "on_hold", "completed", "archived"])

// Create project input
export const createProjectSchema = z.object({
  companyId: z.string().min(1, "Company ID is required"),
  name: z.string().min(1, "Name is required").max(100, "Name must be 100 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .optional(),
  icon: z.string().max(4, "Icon must be 4 characters or less").optional(),
  startDate: z.string().datetime().optional().nullable(),
  targetEndDate: z.string().datetime().optional().nullable(),
})

// Update project input
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: projectStatusSchema.optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  icon: z.string().max(4).optional(),
  startDate: z.string().datetime().optional().nullable(),
  targetEndDate: z.string().datetime().optional().nullable(),
})

// Query parameters for GET requests
export const getProjectsQuerySchema = z.object({
  companyId: z.string().min(1, "Company ID is required"),
  status: projectStatusSchema.optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
})

// Types
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
export type GetProjectsQuery = z.infer<typeof getProjectsQuerySchema>
