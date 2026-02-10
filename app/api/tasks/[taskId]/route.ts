import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User, Update, Project } from "@/lib/models"
import { taskTransformer } from "@/lib/transformers"
import { notificationService } from "@/lib/services"
import mongoose from "mongoose"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    console.log("[Task API GET] Fetching task:", taskId)

    // Validate taskId format
    if (!taskId || !mongoose.Types.ObjectId.isValid(taskId)) {
      console.log("[Task API GET] Invalid taskId format:", taskId)
      return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 })
    }

    await connectToDatabase()

    const task = await Task.findById(taskId)
      .populate("assigned_to", "full_name username telegram_id")
      .populate("created_by", "full_name username telegram_id")
      .lean()

    if (!task) {
      console.log("[Task API GET] Task not found in database:", taskId)
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    console.log("[Task API GET] Task found:", task._id, task.title)
    const transformedTask = taskTransformer.toFrontend(task as any)
    console.log("[Task API GET] Transformed task id:", transformedTask.id)

    return NextResponse.json(
      {
        task: transformedTask,
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("[Task API GET] Error fetching task:", error)
    return NextResponse.json({ error: "Failed to fetch task" }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const body = await request.json()
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const task = await Task.findById(taskId)
      .populate("assigned_to", "telegram_id full_name")
      .populate("created_by", "telegram_id full_name")
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const oldStatus = task.status

    // Update fields
    if (body.title !== undefined) task.title = body.title
    if (body.description !== undefined) task.description = body.description
    if (body.dueDate !== undefined) task.due_date = new Date(body.dueDate)
    if (body.status !== undefined) {
      task.status = body.status
      if (body.status === "completed") {
        task.completed_at = new Date()
      }
    }
    if (body.priority !== undefined) task.priority = body.priority
    if (body.category !== undefined) task.category = body.category
    if (body.tags !== undefined) task.tags = body.tags

    // Handle assignedTo updates
    if (body.assignedTo !== undefined) {
      const assignedUserIds: mongoose.Types.ObjectId[] = []
      for (const id of body.assignedTo) {
        let foundUser = null
        // Try finding by ObjectId first
        if (mongoose.Types.ObjectId.isValid(id)) {
          foundUser = await User.findById(id)
        }
        // Try finding by telegram_id
        if (!foundUser) {
          foundUser = await User.findOne({ telegram_id: id.toString() })
        }
        if (foundUser) {
          assignedUserIds.push(foundUser._id)
        }
      }
      task.assigned_to = assignedUserIds
    }

    await task.save()

    // Log status change
    if (body.status && body.status !== oldStatus) {
      await Update.create({
        task_id: task._id,
        user_id: user._id,
        action: "status_changed",
        old_value: oldStatus,
        new_value: body.status,
        message: `Status changed from ${oldStatus} to ${body.status}`,
      })

      // Get project details for notifications
      let projectName: string | undefined
      let projectId: string | undefined
      if (task.project_id) {
        const project = await Project.findById(task.project_id).lean()
        projectName = project?.name
        projectId = project?._id?.toString()
      }

      const peopleToNotify = new Map<string, { telegramId: string; fullName: string }>()

      // Add all assigned users
      const assignedUsers = task.assigned_to as any[]
      for (const assignedUser of assignedUsers) {
        if (assignedUser.telegram_id && assignedUser.telegram_id !== telegramId) {
          peopleToNotify.set(assignedUser.telegram_id, {
            telegramId: assignedUser.telegram_id,
            fullName: assignedUser.full_name || "User",
          })
        }
      }

      // Add task creator (admin notification)
      const creator = task.created_by as any
      if (creator?.telegram_id && creator.telegram_id !== telegramId) {
        peopleToNotify.set(creator.telegram_id, {
          telegramId: creator.telegram_id,
          fullName: creator.full_name || "User",
        })
      }

      // Send notifications using centralized service
      for (const [notifyTelegramId, recipient] of peopleToNotify) {
        if (body.status === "completed") {
          await notificationService.notifyTaskCompleted({
            telegramId: notifyTelegramId,
            recipientName: recipient.fullName,
            taskTitle: task.title,
            taskId: task._id.toString(),
            completedBy: user.full_name,
            completedByTelegramId: telegramId,
            projectName,
            projectId,
          })
        } else {
          await notificationService.notifyTaskStatusChange({
            telegramId: notifyTelegramId,
            recipientName: recipient.fullName,
            taskTitle: task.title,
            taskId: task._id.toString(),
            oldStatus,
            newStatus: body.status,
            changedBy: user.full_name,
            changedByTelegramId: telegramId,
            projectName,
            projectId,
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating task:", error)
    return NextResponse.json({ error: "Failed to update task" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    await Task.findByIdAndDelete(taskId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
