import { type NextRequest, NextResponse } from "next/server"
import { db, timeLogs, users } from "@/lib/db"
import { eq, and, isNull } from "drizzle-orm"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId } = body
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

    // Check for existing active log
    const existingLog = await db.query.timeLogs.findFirst({
      where: and(
        eq(timeLogs.user_id, user.id),
        isNull(timeLogs.end_time)
      ),
    })

    if (existingLog) {
      return NextResponse.json({ error: "Already clocked in" }, { status: 400 })
    }

    const [timeLog] = await db
      .insert(timeLogs)
      .values({
        task_id: taskId,
        user_id: user.id,
        start_time: new Date(),
      })
      .returning()

    return NextResponse.json({
      timeLog: {
        id: timeLog.id,
        taskId: timeLog.task_id,
        startTime: timeLog.start_time,
      },
    })
  } catch (error) {
    console.error("Error clocking in:", error)
    return NextResponse.json({ error: "Failed to clock in" }, { status: 500 })
  }
}
