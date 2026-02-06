import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User, Update } from "@/lib/models"
import { taskTransformer } from "@/lib/transformers"
import { notificationService } from "@/lib/services"
import mongoose from "mongoose"

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params

    await connectToDatabase()

    const task = await Task.findById(taskId)
      .populate("assigned_to", "full_name username telegram_id")
      .populate("created_by", "full_name username telegram_id")
      .lean()

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json(
      {
        task: taskTransformer.toFrontend(task as any),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching task:", error)
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

      const peopleToNotify = new Set<string>()

      // Add all assigned users
      const assignedUsers = task.assigned_to as any[]
      for (const assignedUser of assignedUsers) {
        if (assignedUser.telegram_id && assignedUser.telegram_id !== telegramId) {
          peopleToNotify.add(assignedUser.telegram_id)
        }
      }

      // Add task creator (admin notification)
      const creator = task.created_by as any
      if (creator?.telegram_id && creator.telegram_id !== telegramId) {
        peopleToNotify.add(creator.telegram_id)
      }

      // Send notifications using centralized service
      for (const notifyTelegramId of peopleToNotify) {
        if (body.status === "completed") {
          await notificationService.notifyTaskCompleted({
            telegramId: notifyTelegramId,
            taskTitle: task.title,
            taskId: task._id.toString(),
            completedBy: user.full_name,
          })
        } else {
          await notificationService.notifyTaskStatusChange({
            telegramId: notifyTelegramId,
            taskTitle: task.title,
            taskId: task._id.toString(),
            oldStatus,
            newStatus: body.status,
            changedBy: user.full_name,
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
