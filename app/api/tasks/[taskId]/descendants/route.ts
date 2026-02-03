import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task } from "@/lib/models"
import { taskTransformer } from "@/lib/transformers"
import mongoose from "mongoose"

// GET /api/tasks/{id}/descendants - Get all descendants (recursive)
export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Get the parent task
    let parentTask: any = null
    if (mongoose.Types.ObjectId.isValid(taskId)) {
      parentTask = await Task.findById(taskId)
    }

    if (!parentTask) {
      parentTask = await Task.findOne({ _id: taskId })
    }

    if (!parentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Get all descendants - tasks where this task is in their path
    const descendants = await Task.find({
      path: parentTask._id,
    })
      .populate("assigned_to", "telegram_id full_name username")
      .populate("created_by", "telegram_id full_name username")
      .sort({ depth: 1, createdAt: -1 })
      .lean()

    const formattedDescendants = taskTransformer.toList(descendants as any[])

    return NextResponse.json({
      descendants: formattedDescendants,
      count: formattedDescendants.length,
    })
  } catch (error) {
    console.error("Error fetching descendants:", error)
    return NextResponse.json({ error: "Failed to fetch descendants" }, { status: 500 })
  }
}
