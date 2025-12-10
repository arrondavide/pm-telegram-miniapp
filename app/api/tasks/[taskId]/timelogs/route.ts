import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { TimeLog } from "@/lib/models"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    await connectToDatabase()

    const timeLogs = await TimeLog.find({ task_id: taskId })
      .populate("user_id", "telegram_id full_name username")
      .sort({ start_time: -1 })

    const formattedLogs = timeLogs.map((log) => ({
      id: log._id.toString(),
      taskId: log.task_id.toString(),
      userId: log.user_id?._id?.toString() || "",
      userTelegramId: (log.user_id as any)?.telegram_id || "",
      userName: (log.user_id as any)?.full_name || "Unknown",
      startTime: log.start_time.toISOString(),
      endTime: log.end_time?.toISOString() || null,
      durationMinutes: log.duration_minutes || 0,
      durationSeconds: (log.duration_minutes || 0) * 60,
      note: log.note || "",
    }))

    return NextResponse.json({ timeLogs: formattedLogs })
  } catch (error) {
    console.error("Error fetching time logs:", error)
    return NextResponse.json({ error: "Failed to fetch time logs" }, { status: 500 })
  }
}
