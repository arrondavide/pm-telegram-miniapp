import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, Task } from "@/lib/models"
import mongoose from "mongoose"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    await connectToDatabase()

    let timeLogs: any[] = []

    if (mongoose.Types.ObjectId.isValid(taskId)) {
      timeLogs = await TimeLog.find({
        task_id: new mongoose.Types.ObjectId(taskId),
      })
        .populate("user_id", "telegram_id full_name username")
        .sort({ start_time: -1 })
        .lean()
    }

    if (timeLogs.length === 0) {
      const task = mongoose.Types.ObjectId.isValid(taskId)
        ? await Task.findById(taskId)
        : await Task.findOne({ _id: taskId })

      if (task) {
        timeLogs = await TimeLog.find({
          task_id: task._id,
        })
          .populate("user_id", "telegram_id full_name username")
          .sort({ start_time: -1 })
          .lean()
      }
    }

    const formattedLogs = timeLogs.map((log: any) => {
      let durationSeconds = 0

      if (log.end_time) {
        // Completed log
        if (log.duration_minutes) {
          durationSeconds = log.duration_minutes * 60
        } else if (log.start_time) {
          const durationMs = new Date(log.end_time).getTime() - new Date(log.start_time).getTime()
          durationSeconds = Math.floor(durationMs / 1000)
        }
      }

      return {
        id: log._id.toString(),
        taskId: log.task_id?.toString() || taskId,
        userId: log.user_id?._id?.toString() || "",
        userTelegramId: log.user_id?.telegram_id || "",
        userName: log.user_id?.full_name || "Unknown",
        startTime: log.start_time?.toISOString() || new Date().toISOString(),
        endTime: log.end_time?.toISOString() || null,
        durationMinutes: log.duration_minutes || 0,
        durationSeconds,
        note: log.note || "",
        isActive: !log.end_time,
      }
    })

    return NextResponse.json({ timeLogs: formattedLogs })
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return NextResponse.json({ timeLogs: [] })
  }
}
