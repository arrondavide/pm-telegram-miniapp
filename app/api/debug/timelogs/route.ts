import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, Task, User } from "@/lib/models"
import mongoose from "mongoose"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get("taskId")
    const telegramId = searchParams.get("telegramId")

    await connectToDatabase()

    const result: any = {
      query: { taskId, telegramId },
      timeLogs: [],
      user: null,
      task: null,
    }

    // Get user info
    if (telegramId) {
      result.user = await User.findOne({ telegram_id: telegramId }).lean()
    }

    // Get task info
    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      result.task = await Task.findById(taskId).lean()
    }

    // Get all time logs for this task
    if (taskId) {
      if (mongoose.Types.ObjectId.isValid(taskId)) {
        result.timeLogs = await TimeLog.find({
          task_id: new mongoose.Types.ObjectId(taskId),
        })
          .populate("user_id", "telegram_id full_name username")
          .sort({ start_time: -1 })
          .lean()
      }
    }

    // Get all time logs for this user
    if (result.user) {
      result.userTimeLogs = await TimeLog.find({
        user_id: result.user._id,
      })
        .populate("task_id", "title")
        .sort({ start_time: -1 })
        .limit(10)
        .lean()
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json({ error: String(error) }, { status: 500 })
  }
}
