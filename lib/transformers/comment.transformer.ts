/**
 * Comment data transformation utilities
 * Converts between database (snake_case) and frontend (camelCase) formats
 */

import type { Comment } from "@/types/models.types"

interface DbCommentPopulatedUser {
  _id?: { toString(): string }
  telegram_id?: string
  full_name?: string
  username?: string
}

interface DbComment {
  _id: { toString(): string }
  task_id: { toString(): string } | string
  user_id: DbCommentPopulatedUser | { toString(): string } | string
  message: string
  mentions?: ({ toString(): string } | string)[]
  attachments?: Array<{ file_id: string; file_name: string }>
  createdAt: Date
  updatedAt?: Date
}

export const commentTransformer = {
  /**
   * Transform database comment document to frontend format
   */
  toFrontend(doc: DbComment): Comment {
    const taskId = typeof doc.task_id === "string" ? doc.task_id : doc.task_id?.toString() || ""

    // Handle user_id - could be populated object or just an ObjectId
    let userId = ""
    let userName: string | undefined = undefined

    if (typeof doc.user_id === "string") {
      userId = doc.user_id
    } else if (doc.user_id && typeof doc.user_id === "object" && "_id" in doc.user_id) {
      const user = doc.user_id as DbCommentPopulatedUser
      userId = user._id?.toString() || ""
      userName = user.full_name
    } else if (doc.user_id && typeof (doc.user_id as { toString(): string }).toString === "function") {
      userId = (doc.user_id as { toString(): string }).toString()
    }

    return {
      id: doc._id.toString(),
      taskId,
      userId,
      userName,
      message: doc.message,
      createdAt: doc.createdAt.toISOString(),
    }
  },

  /**
   * Transform to legacy format used by some components
   */
  toLegacyFormat(doc: DbComment): {
    id: string
    message: string
    user: { id: string; fullName: string; username: string } | null
    createdAt: Date
  } {
    let user = null

    if (doc.user_id && typeof doc.user_id === "object" && "_id" in doc.user_id) {
      const u = doc.user_id as DbCommentPopulatedUser
      user = {
        id: u._id?.toString() || "",
        fullName: u.full_name || "Unknown",
        username: u.username || "",
      }
    }

    return {
      id: doc._id.toString(),
      message: doc.message,
      user,
      createdAt: doc.createdAt,
    }
  },

  /**
   * Transform frontend comment data to database format
   */
  toDatabase(data: Partial<Comment>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    if (data.taskId !== undefined) result.task_id = data.taskId
    if (data.userId !== undefined) result.user_id = data.userId
    if (data.message !== undefined) result.message = data.message

    return result
  },

  /**
   * Transform array of comments
   */
  toList(docs: DbComment[]): Comment[] {
    return docs.map((doc) => this.toFrontend(doc))
  },

  /**
   * Transform array to legacy format
   */
  toLegacyList(docs: DbComment[]) {
    return docs.map((doc) => this.toLegacyFormat(doc))
  },
}
