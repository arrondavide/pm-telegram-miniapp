import { type NextRequest, NextResponse } from "next/server"
import { db, timeLogs, users } from "@/lib/db"
import { eq, inArray } from "drizzle-orm"
import { timelogTransformer } from "@/lib/transformers"

function toTimeLogDoc(log: any, userRow?: any) {
  // Schema stores duration_seconds; transformer expects duration_minutes
  const durationMinutes = log.duration_seconds ? Math.floor(log.duration_seconds / 60) : undefined

  return {
    _id: { toString: () => log.id },
    task_id: log.task_id,
    user_id: userRow
      ? {
          _id: { toString: () => userRow.id },
          telegram_id: userRow.telegram_id,
          full_name: userRow.full_name,
          username: userRow.username ?? "",
        }
      : log.user_id ?? "",
    start_time: log.start_time,
    end_time: log.end_time ?? null,
    duration_minutes: durationMinutes,
    note: log.note ?? "",
    createdAt: log.created_at,
    updatedAt: log.updated_at,
  } as any
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    const logRows = await db
      .select()
      .from(timeLogs)
      .where(eq(timeLogs.task_id, taskId))
      .orderBy(timeLogs.start_time)

    // Fetch user info for all logs
    const userIds = [...new Set(logRows.map((l) => l.user_id).filter(Boolean) as string[])]
    const userMap = new Map<string, any>()

    if (userIds.length > 0) {
      const userRows = await db.select().from(users).where(inArray(users.id, userIds))
      userRows.forEach((u) => userMap.set(u.id, u))
    }

    const logDocs = logRows.map((l) => toTimeLogDoc(l, l.user_id ? userMap.get(l.user_id) : undefined))

    return NextResponse.json({ timeLogs: timelogTransformer.toList(logDocs, taskId) })
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return NextResponse.json({ timeLogs: [] })
  }
}
