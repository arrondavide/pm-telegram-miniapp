import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, Task } from "@/lib/models"
import mongoose from "mongoose"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    await connectToDatabase()

    let timeLogs = []

    // Strategy 1: Direct ObjectId match
    if (mongoose.Types.ObjectId.isValid(taskId)) {
      timeLogs = await TimeLog.find({
        task_id: new mongoose.Types.ObjectId(taskId),
        end_time: { $ne: null }, // Only get completed time logs
      })
        .populate("user_id", "telegram_id full_name username")
        .sort({ start_time: -1 })
        .lean()
    }

    // Strategy 2: If no results, try finding the task first
    if (timeLogs.length === 0) {
      let task = null

      if (mongoose.Types.ObjectId.isValid(taskId)) {
        task = await Task.findById(taskId)
      }

      if (!task) {
        task = await Task.findOne({ _id: taskId })
      }

      if (task) {
        timeLogs = await TimeLog.find({
          task_id: task._id,
          end_time: { $ne: null },
        })
          .populate("user_id", "telegram_id full_name username")
          .sort({ start_time: -1 })
          .lean()
      }
    }

    const formattedLogs = timeLogs.map((log: any) => ({
      id: log._id.toString(),
      taskId: log.task_id?.toString() || taskId,
      userId: log.user_id?._id?.toString() || "",
      userTelegramId: log.user_id?.telegram_id || "",
      userName: log.user_id?.full_name || "Unknown",
      startTime: log.start_time?.toISOString() || new Date().toISOString(),
      endTime: log.end_time?.toISOString() || null,
      durationMinutes: log.duration_minutes || 0,
      durationSeconds: (log.duration_minutes || 0) * 60,
      note: log.note || "",
    }))

    return NextResponse.json({ timeLogs: formattedLogs })
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return NextResponse.json({ timeLogs: [] })
  }
}
