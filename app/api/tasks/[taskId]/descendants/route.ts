import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task } from "@/lib/models"
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

    const formattedDescendants = descendants.map((task: any) => ({
      id: task._id.toString(),
      title: task.title,
      description: task.description || "",
      dueDate: task.due_date.toISOString(),
      status: task.status,
      priority: task.priority,
      assignedTo: (task.assigned_to || []).map((a: any) => ({
        id: a._id?.toString() || "",
        fullName: a.full_name || "Unknown",
        username: a.username || "",
        telegramId: a.telegram_id || "",
      })),
      createdBy: {
        id: task.created_by?._id?.toString() || "",
        fullName: task.created_by?.full_name || "Unknown",
        username: task.created_by?.username || "",
        telegramId: task.created_by?.telegram_id || "",
      },
      companyId: task.company_id.toString(),
      projectId: task.project_id.toString(),
      parentTaskId: task.parent_task_id?.toString() || null,
      depth: task.depth || 0,
      path: (task.path || []).map((p: any) => p.toString()),
      category: task.category || "",
      tags: task.tags || [],
      department: task.department || "",
      estimatedHours: task.estimated_hours || 0,
      actualHours: task.actual_hours || 0,
      completedAt: task.completed_at?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    }))

    return NextResponse.json({
      descendants: formattedDescendants,
      count: formattedDescendants.length,
    })
  } catch (error) {
    console.error("Error fetching descendants:", error)
    return NextResponse.json({ error: "Failed to fetch descendants" }, { status: 500 })
  }
}
