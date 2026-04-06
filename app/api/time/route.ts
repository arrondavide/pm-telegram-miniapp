import { type NextRequest, NextResponse } from "next/server"
import { db, timeLogs, users, tasks } from "@/lib/db"
import { eq, and, isNull } from "drizzle-orm"

export async function GET(request: NextRequest) {
  try {
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({
      where: eq(users.telegram_id, telegramId),
    })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get active time log (no end_time)
    const activeLog = await db.query.timeLogs.findFirst({
      where: and(
        eq(timeLogs.user_id, user.id),
        isNull(timeLogs.end_time)
      ),
    })

    if (!activeLog) {
      return NextResponse.json({ active: null })
    }

    // Fetch associated task title
    const task = activeLog.task_id
      ? await db.query.tasks.findFirst({ where: eq(tasks.id, activeLog.task_id) })
      : null

    return NextResponse.json({
      active: {
        id: activeLog.id,
        taskId: activeLog.task_id,
        taskTitle: task?.title ?? null,
        startTime: activeLog.start_time,
      },
    })
  } catch (error) {
    console.error("Error fetching time log:", error)
    return NextResponse.json({ error: "Failed to fetch time log" }, { status: 500 })
  }
}
