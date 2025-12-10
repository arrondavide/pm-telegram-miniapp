import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User, Update } from "@/lib/models"
import mongoose from "mongoose"

async function createNotification(
  telegramId: string,
  type: string,
  title: string,
  message: string,
  taskId?: string,
  sendTelegram = true,
) {
  try {
    const NotificationSchema = new mongoose.Schema({
      telegram_id: String,
      type: String,
      title: String,
      message: String,
      task_id: String,
      read: { type: Boolean, default: false },
      created_at: { type: Date, default: Date.now },
    })

    const AppNotification = mongoose.models.AppNotification || mongoose.model("AppNotification", NotificationSchema)

    await AppNotification.create({
      telegram_id: telegramId,
      type,
      title,
      message,
      task_id: taskId,
      read: false,
    })

    const BOT_TOKEN = process.env.BOT_TOKEN
    if (sendTelegram && BOT_TOKEN) {
      const telegramMessage = `<b>${title}</b>\n\n${message}`
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramId,
          text: telegramMessage,
          parse_mode: "HTML",
        }),
      })
    }
  } catch (error) {
    console.error("Failed to create notification:", error)
  }
}

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

    return NextResponse.json({
      task: {
        id: (task as any)._id.toString(),
        title: task.title,
        description: task.description,
        dueDate: task.due_date,
        status: task.status,
        priority: task.priority,
        category: task.category,
        tags: task.tags,
        department: task.department,
        subtasks: task.subtasks,
        assignedTo: (task.assigned_to as any[]).map((u: any) => ({
          id: u._id.toString(),
          fullName: u.full_name,
          username: u.username,
          telegramId: u.telegram_id,
        })),
        createdBy: task.created_by
          ? {
              id: (task.created_by as any)._id.toString(),
              fullName: (task.created_by as any).full_name,
              username: (task.created_by as any).username,
              telegramId: (task.created_by as any).telegram_id,
            }
          : null,
        estimatedHours: task.estimated_hours,
        actualHours: task.actual_hours,
        completedAt: task.completed_at,
        createdAt: (task as any).createdAt,
        updatedAt: (task as any).updatedAt,
      },
    })
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
    if (body.subtasks !== undefined) task.subtasks = body.subtasks

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

      // Send notifications
      for (const notifyTelegramId of peopleToNotify) {
        let notifTitle = "Task Updated"
        let notifMessage = ""
        let notifType = "task_updated"

        if (body.status === "completed") {
          notifTitle = "Task Completed"
          notifMessage = `${task.title}\n\nCompleted by: ${user.full_name}`
          notifType = "task_completed"
        } else {
          notifMessage = `${task.title}\n\nStatus: ${oldStatus} → ${body.status}\nUpdated by: ${user.full_name}`
        }

        await createNotification(notifyTelegramId, notifType, notifTitle, notifMessage, task._id.toString())
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
