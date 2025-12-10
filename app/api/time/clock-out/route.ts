import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, Task, User } from "@/lib/models"

export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const timeLog = await TimeLog.findOne({
      user_id: user._id,
      end_time: null,
    })

    if (!timeLog) {
      return NextResponse.json({ error: "Not clocked in" }, { status: 400 })
    }

    const endTime = new Date()
    const durationMinutes = Math.round((endTime.getTime() - timeLog.start_time.getTime()) / 60000)

    timeLog.end_time = endTime
    timeLog.duration_minutes = durationMinutes
    await timeLog.save()

    // Update task actual hours
    await Task.findByIdAndUpdate(timeLog.task_id, {
      $inc: { actual_hours: durationMinutes / 60 },
    })

    return NextResponse.json({
      timeLog: {
        id: timeLog._id.toString(),
        durationMinutes,
        endTime,
      },
    })
  } catch (error) {
    console.error("Error clocking out:", error)
    return NextResponse.json({ error: "Failed to clock out" }, { status: 500 })
  }
}
