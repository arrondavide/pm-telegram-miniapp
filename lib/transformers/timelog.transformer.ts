/**
 * TimeLog data transformation utilities
 * Converts between database (snake_case) and frontend (camelCase) formats
 */

import type { TimeLog } from "@/types/models.types"

interface DbTimeLogPopulatedUser {
  _id?: { toString(): string }
  telegram_id?: string
  full_name?: string
  username?: string
}

interface DbTimeLog {
  _id: { toString(): string }
  task_id: { toString(): string } | string
  user_id: DbTimeLogPopulatedUser | { toString(): string } | string
  start_time: Date
  end_time?: Date | null
  duration_minutes?: number
  note?: string
  createdAt?: Date
  updatedAt?: Date
}

export const timelogTransformer = {
  /**
   * Transform database timelog document to frontend format
   */
  toFrontend(doc: DbTimeLog, taskIdFallback?: string): TimeLog {
    const taskId = typeof doc.task_id === "string" ? doc.task_id : doc.task_id?.toString() || taskIdFallback || ""

    // Handle user_id - could be populated object or just an ObjectId
    let userId = ""
    let userName = "Unknown"
    let userTelegramId: string | undefined = undefined

    if (typeof doc.user_id === "string") {
      userId = doc.user_id
    } else if (doc.user_id && typeof doc.user_id === "object" && "_id" in doc.user_id) {
      const user = doc.user_id as DbTimeLogPopulatedUser
      userId = user._id?.toString() || ""
      userName = user.full_name || "Unknown"
      userTelegramId = user.telegram_id
    } else if (doc.user_id && typeof (doc.user_id as { toString(): string }).toString === "function") {
      userId = (doc.user_id as { toString(): string }).toString()
    }

    // Calculate duration
    let durationSeconds = 0
    let durationMinutes = doc.duration_minutes || 0

    if (doc.end_time) {
      if (doc.duration_minutes) {
        durationSeconds = doc.duration_minutes * 60
      } else if (doc.start_time) {
        const durationMs = new Date(doc.end_time).getTime() - new Date(doc.start_time).getTime()
        durationSeconds = Math.floor(durationMs / 1000)
        durationMinutes = Math.floor(durationSeconds / 60)
      }
    }

    return {
      id: doc._id.toString(),
      taskId,
      userId,
      userName,
      userTelegramId,
      startTime: doc.start_time?.toISOString() || new Date().toISOString(),
      endTime: doc.end_time?.toISOString() || null,
      durationMinutes,
      durationSeconds,
      note: doc.note || "",
    }
  },

  /**
   * Transform frontend timelog data to database format
   */
  toDatabase(data: Partial<TimeLog>): Record<string, unknown> {
    const result: Record<string, unknown> = {}

    if (data.taskId !== undefined) result.task_id = data.taskId
    if (data.userId !== undefined) result.user_id = data.userId
    if (data.startTime !== undefined) result.start_time = new Date(data.startTime)
    if (data.endTime !== undefined) result.end_time = data.endTime ? new Date(data.endTime) : null
    if (data.durationMinutes !== undefined) result.duration_minutes = data.durationMinutes
    if (data.note !== undefined) result.note = data.note

    return result
  },

  /**
   * Transform array of timelogs
   */
  toList(docs: DbTimeLog[], taskIdFallback?: string): TimeLog[] {
    return docs.map((doc) => this.toFrontend(doc, taskIdFallback))
  },
}
