/**
 * Project data transformation utilities
 * Converts between database (snake_case) and frontend (camelCase) formats
 */

import type { Project } from "@/types/models.types"
import { userTransformer } from "./user.transformer"

interface DbProjectPopulatedUser {
  _id?: { toString(): string }
  telegram_id?: string
  full_name?: string
  username?: string
}

interface DbProject {
  _id: { toString(): string }
  name: string
  description?: string
  company_id: { toString(): string } | string
  status: "active" | "on_hold" | "completed" | "archived"
  created_by: DbProjectPopulatedUser | { toString(): string } | string
  color?: string
  icon?: string
  start_date?: Date
  target_end_date?: Date
  completed_at?: Date
  archived_at?: Date
  createdAt: Date
  updatedAt: Date
}

export const projectTransformer = {
  /**
   * Transform database project document to frontend format
   */
  toFrontend(doc: DbProject): Project {
    const companyId = typeof doc.company_id === "string" ? doc.company_id : doc.company_id.toString()

    // Handle created_by - could be populated object or just an ObjectId
    let createdBy: Project["createdBy"]
    if (typeof doc.created_by === "string") {
      createdBy = doc.created_by
    } else if (doc.created_by && typeof doc.created_by === "object" && "_id" in doc.created_by) {
      createdBy = userTransformer.toSummary(doc.created_by as DbProjectPopulatedUser)
    } else if (doc.created_by && typeof (doc.created_by as { toString(): string }).toString === "function") {
      createdBy = (doc.created_by as { toString(): string }).toString()
    } else {
      createdBy = ""
    }

    return {
      id: doc._id.toString(),
      name: doc.name,
      description: doc.description || "",
      companyId,
      status: doc.status,
      createdBy,
      color: doc.color || "#3b82f6",
      icon: doc.icon || "📁",
      startDate: doc.start_date?.toISOString() || null,
      targetEndDate: doc.target_end_date?.toISOString() || null,
      completedAt: doc.completed_at?.toISOString() || null,
      archivedAt: doc.archived_at?.toISOString() || null,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }
  },

  /**
   * Transform frontend project data to database format
   */
  toDatabase(data: Partial<Project>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    if (data.name !== undefined) result.name = data.name
    if (data.description !== undefined) result.description = data.description
    if (data.companyId !== undefined) result.company_id = data.companyId
    if (data.status !== undefined) result.status = data.status
    if (data.color !== undefined) result.color = data.color
    if (data.icon !== undefined) result.icon = data.icon
    if (data.startDate !== undefined) {
      result.start_date = data.startDate ? new Date(data.startDate) : undefined
    }
    if (data.targetEndDate !== undefined) {
      result.target_end_date = data.targetEndDate ? new Date(data.targetEndDate) : undefined
    }
    if (data.completedAt !== undefined) {
      result.completed_at = data.completedAt ? new Date(data.completedAt) : undefined
    }
    if (data.archivedAt !== undefined) {
      result.archived_at = data.archivedAt ? new Date(data.archivedAt) : undefined
    }

    return result
  },

  /**
   * Transform array of projects
   */
  toList(docs: DbProject[]): Project[] {
    return docs.map((doc) => this.toFrontend(doc))
  },
}
