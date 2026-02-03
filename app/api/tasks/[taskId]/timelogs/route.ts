import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog, Task } from "@/lib/models"
import { timelogTransformer } from "@/lib/transformers"
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

    return NextResponse.json({ timeLogs: timelogTransformer.toList(timeLogs, taskId) })
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return NextResponse.json({ timeLogs: [] })
  }
}
