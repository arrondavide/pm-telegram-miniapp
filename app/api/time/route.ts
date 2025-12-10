import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, User } from "@/lib/models"

export async function GET(request: NextRequest) {
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

    // Get active time log (no end_time)
    const activeLog = await TimeLog.findOne({
      user_id: user._id,
      end_time: null,
    })
      .populate("task_id", "title")
      .lean()

    if (!activeLog) {
      return NextResponse.json({ active: null })
    }

    return NextResponse.json({
      active: {
        id: (activeLog as any)._id.toString(),
        taskId: (activeLog.task_id as any)?._id?.toString(),
        taskTitle: (activeLog.task_id as any)?.title,
        startTime: activeLog.start_time,
      },
    })
  } catch (error) {
    console.error("Error fetching time log:", error)
    return NextResponse.json({ error: "Failed to fetch time log" }, { status: 500 })
  }
}
