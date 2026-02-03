/**
 * User data transformation utilities
 * Converts between database (snake_case) and frontend (camelCase) formats
 */

import type { User, UserSummary, UserCompany } from "@/types/models.types"

interface DbUserCompany {
  company_id: { toString(): string } | string
  role: "admin" | "manager" | "employee"
  department: string
  joined_at: Date
}

interface DbUser {
  _id: { toString(): string }
  telegram_id: string
  full_name: string
  username: string
  companies: DbUserCompany[]
  active_company_id?: { toString(): string } | string | null
  preferences?: {
    daily_digest?: boolean
    reminder_time?: string
  }
  createdAt: Date
  updatedAt?: Date
}

interface DbUserPopulated {
  _id?: { toString(): string }
  telegram_id?: string
  full_name?: string
  username?: string
}

export const userTransformer = {
  /**
   * Transform database user document to frontend format
   */
  toFrontend(doc: DbUser): User {
    return {
      id: doc._id.toString(),
      telegramId: doc.telegram_id,
      fullName: doc.full_name,
      username: doc.username || "",
      companies: doc.companies.map((c) => ({
        companyId: typeof c.company_id === "string" ? c.company_id : c.company_id.toString(),
        role: c.role,
        department: c.department || "",
        joinedAt: c.joined_at,
      })),
      activeCompanyId: doc.active_company_id
        ? typeof doc.active_company_id === "string"
          ? doc.active_company_id
          : doc.active_company_id.toString()
        : null,
      preferences: {
        dailyDigest: doc.preferences?.daily_digest ?? true,
        reminderTime: doc.preferences?.reminder_time || "09:00",
      },
      createdAt: doc.createdAt,
    }
  },

  /**
   * Transform user to summary format (for embedded references)
   */
  toSummary(doc: DbUserPopulated | null | undefined): UserSummary {
    if (!doc) {
      return {
        id: "",
        fullName: "Unknown",
        username: "",
        telegramId: "",
      }
    }

    return {
      id: doc._id?.toString() || "",
      fullName: doc.full_name || "Unknown",
      username: doc.username || "",
      telegramId: doc.telegram_id || "",
    }
  },

  /**
   * Transform frontend user data to database format
   */
  toDatabase(data: Partial<User>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    if (data.fullName !== undefined) result.full_name = data.fullName
    if (data.username !== undefined) result.username = data.username
    if (data.activeCompanyId !== undefined) result.active_company_id = data.activeCompanyId

    if (data.preferences) {
      result.preferences = {
        daily_digest: data.preferences.dailyDigest,
        reminder_time: data.preferences.reminderTime,
      }
    }

    if (data.companies) {
      result.companies = data.companies.map((c: UserCompany) => ({
        company_id: c.companyId,
        role: c.role,
        department: c.department,
        joined_at: c.joinedAt,
      }))
    }

    return result
  },

  /**
   * Transform array of users
   */
  toList(docs: DbUser[]): User[] {
    return docs.map((doc) => this.toFrontend(doc))
  },
}
