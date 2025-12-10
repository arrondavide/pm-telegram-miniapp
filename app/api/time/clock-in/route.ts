import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, User } from "@/lib/models"
import mongoose from "mongoose"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId } = body
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check for existing active log
    const existingLog = await TimeLog.findOne({
      user_id: user._id,
      end_time: null,
    })

    if (existingLog) {
      return NextResponse.json({ error: "Already clocked in" }, { status: 400 })
    }

    const timeLog = await TimeLog.create({
      task_id: new mongoose.Types.ObjectId(taskId),
      user_id: user._id,
      start_time: new Date(),
    })

    return NextResponse.json({
      timeLog: {
        id: timeLog._id.toString(),
        taskId,
        startTime: timeLog.start_time,
      },
    })
  } catch (error) {
    console.error("Error clocking in:", error)
    return NextResponse.json({ error: "Failed to clock in" }, { status: 500 })
  }
}
