import { type NextRequest, NextResponse } from "next/server"
import { db, timeLogs, tasks, users } from "@/lib/db"
import { eq, and, isNull, sql } from "drizzle-orm"

export async function POST(request: NextRequest) {
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

    const timeLog = await db.query.timeLogs.findFirst({
      where: and(
        eq(timeLogs.user_id, user.id),
        isNull(timeLogs.end_time)
      ),
    })

    if (!timeLog) {
      return NextResponse.json({ error: "Not clocked in" }, { status: 400 })
    }

    const endTime = new Date()
    const durationSeconds = Math.round((endTime.getTime() - timeLog.start_time.getTime()) / 1000)

    await db
      .update(timeLogs)
      .set({
        end_time: endTime,
        duration_seconds: durationSeconds,
        updated_at: new Date(),
      })
      .where(eq(timeLogs.id, timeLog.id))

    // Update task actual_hours (duration_seconds / 3600, rounded to nearest integer hour)
    if (timeLog.task_id) {
      const additionalHours = Math.round(durationSeconds / 3600)
      await db
        .update(tasks)
        .set({
          actual_hours: sql`COALESCE(${tasks.actual_hours}, 0) + ${additionalHours}`,
          updated_at: new Date(),
        })
        .where(eq(tasks.id, timeLog.task_id))
    }

    return NextResponse.json({
      timeLog: {
        id: timeLog.id,
        durationMinutes: Math.round(durationSeconds / 60),
        endTime,
      },
    })
  } catch (error) {
    console.error("Error clocking out:", error)
    return NextResponse.json({ error: "Failed to clock out" }, { status: 500 })
  }
}
