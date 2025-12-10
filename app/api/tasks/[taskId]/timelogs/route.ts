import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, Task } from "@/lib/models"
import mongoose from "mongoose"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    await connectToDatabase()

    let timeLogs = []

    // First try with the taskId directly (if it's a valid ObjectId)
    if (mongoose.Types.ObjectId.isValid(taskId)) {
      timeLogs = await TimeLog.find({ task_id: new mongoose.Types.ObjectId(taskId) })
        .populate("user_id", "telegram_id full_name username")
        .sort({ start_time: -1 })
    }

    // If no results, try finding the task first and then get its time logs
    if (timeLogs.length === 0) {
      // Try to find the task by various IDs
      let task = null

      if (mongoose.Types.ObjectId.isValid(taskId)) {
        task = await Task.findById(taskId)
      }

      if (!task) {
        // Maybe it's stored as a string reference
        task = await Task.findOne({ _id: taskId })
      }

      if (task) {
        timeLogs = await TimeLog.find({ task_id: task._id })
          .populate("user_id", "telegram_id full_name username")
          .sort({ start_time: -1 })
      }
    }

    const formattedLogs = timeLogs.map((log) => ({
      id: log._id.toString(),
      taskId: log.task_id?.toString() || taskId,
      userId: log.user_id?._id?.toString() || "",
      userTelegramId: (log.user_id as any)?.telegram_id || "",
      userName: (log.user_id as any)?.full_name || "Unknown",
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
