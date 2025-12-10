import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User, Update } from "@/lib/models"

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

    const task = await Task.findById(taskId).populate("assigned_to", "telegram_id full_name")
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

      const BOT_TOKEN = process.env.BOT_TOKEN
      if (BOT_TOKEN) {
        const assignedUsers = task.assigned_to as any[]

        for (const assignedUser of assignedUsers) {
          // Don't notify the user who made the change
          if (assignedUser.telegram_id === telegramId) continue

          let message = ""
          if (body.status === "completed") {
            message = `✅ <b>Task Completed</b>\n\n<b>${task.title}</b>\n\nCompleted by: ${user.full_name}`
          } else {
            message = `🔄 <b>Task Updated</b>\n\n<b>${task.title}</b>\n\nStatus: ${oldStatus} → ${body.status}\nUpdated by: ${user.full_name}`
          }

          try {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: assignedUser.telegram_id,
                text: message,
                parse_mode: "HTML",
              }),
            })
          } catch (notifError) {
            console.error("Failed to send notification:", notifError)
          }
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
