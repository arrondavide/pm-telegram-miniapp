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
    // Create in-app notification in database
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

    // Send Telegram notification
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyId,
      projectId,
      parentTaskId,
      title,
      description,
      dueDate,
      priority,
      assignedTo,
      category,
      tags,
      department,
      estimatedHours,
    } = body
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    if (!projectId) {
      return NextResponse.json({ error: "Project ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const assignedUserIds: mongoose.Types.ObjectId[] = []
    const assignedUsers: any[] = []

    if (assignedTo && Array.isArray(assignedTo)) {
      for (const id of assignedTo) {
        let foundUser = null
        if (mongoose.Types.ObjectId.isValid(id)) {
          foundUser = await User.findById(id)
        }
        if (!foundUser) {
          foundUser = await User.findOne({ telegram_id: id.toString() })
        }
        if (foundUser) {
          assignedUserIds.push(foundUser._id)
          assignedUsers.push(foundUser)
        }
      }
    }

    // Calculate depth and path from parent
    let depth = 0
    let path: mongoose.Types.ObjectId[] = []
    let parentTask = null

    if (parentTaskId) {
      parentTask = await Task.findById(parentTaskId)
      if (!parentTask) {
        return NextResponse.json({ error: "Parent task not found" }, { status: 404 })
      }

      // Prevent circular references
      if (parentTask.path.some((p: any) => p.toString() === parentTaskId)) {
        return NextResponse.json({ error: "Circular reference detected" }, { status: 400 })
      }

      // Enforce max depth of 10 levels
      if (parentTask.depth >= 10) {
        return NextResponse.json({ error: "Maximum nesting depth (10) exceeded" }, { status: 400 })
      }

      depth = parentTask.depth + 1
      path = [...parentTask.path, parentTask._id]
    }

    const task = await Task.create({
      title,
      description: description || "",
      due_date: new Date(dueDate),
      status: "pending",
      priority: priority || "medium",
      assigned_to: assignedUserIds,
      created_by: user._id,
      company_id: new mongoose.Types.ObjectId(companyId),
      project_id: new mongoose.Types.ObjectId(projectId),
      parent_task_id: parentTaskId ? new mongoose.Types.ObjectId(parentTaskId) : undefined,
      depth,
      path,
      category: category || "",
      tags: tags || [],
      department: department || "",
      estimated_hours: estimatedHours || 0,
    })

    // Create activity log
    await Update.create({
      task_id: task._id,
      user_id: user._id,
      action: "created",
      message: `Task "${title}" created`,
    })

    if (assignedUsers.length > 0) {
      const formattedDate = new Date(dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })

      for (const assignedUser of assignedUsers) {
        // Don't notify the creator if they assigned themselves
        if (assignedUser.telegram_id === telegramId) continue

        const notifTitle = "New Task Assigned"
        const notifMessage = `${title}\n\nAssigned by: ${user.full_name}\nDue: ${formattedDate}\nPriority: ${priority || "medium"}`

        await createNotification(
          assignedUser.telegram_id,
          "task_assigned",
          notifTitle,
          notifMessage,
          task._id.toString(),
        )
      }
    }

    return NextResponse.json({
      task: {
        id: task._id.toString(),
        title: task.title,
        description: task.description,
        dueDate: task.due_date,
        status: task.status,
        priority: task.priority,
        assignedTo: assignedUserIds.map((id) => id.toString()),
        createdAt: task.createdAt,
      },
    })
  } catch (error) {
    console.error("Error creating task:", error)
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const projectId = searchParams.get("projectId")
    const parentTaskId = searchParams.get("parentTaskId")
    const rootOnly = searchParams.get("rootOnly") === "true"
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const assignedTo = searchParams.get("assignedTo")

    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const query: any = { company_id: new mongoose.Types.ObjectId(companyId) }

    if (projectId) {
      query.project_id = new mongoose.Types.ObjectId(projectId)
    }

    if (rootOnly) {
      query.$or = [{ parent_task_id: null }, { parent_task_id: { $exists: false } }]
    } else if (parentTaskId) {
      query.parent_task_id = new mongoose.Types.ObjectId(parentTaskId)
    }

    if (status && status !== "all") query.status = status
    if (priority && priority !== "all") query.priority = priority
    if (assignedTo) query.assigned_to = new mongoose.Types.ObjectId(assignedTo)

    const tasks = await Task.find(query)
      .populate("assigned_to", "full_name username telegram_id")
      .populate("created_by", "full_name username telegram_id")
      .sort({ due_date: 1 })
      .lean()

    const formattedTasks = tasks.map((task: any) => ({
      id: task._id.toString(),
      title: task.title,
      description: task.description,
      dueDate: task.due_date,
      status: task.status,
      priority: task.priority,
      category: task.category,
      tags: task.tags,
      department: task.department,
      projectId: task.project_id?.toString() || null,
      parentTaskId: task.parent_task_id?.toString() || null,
      depth: task.depth || 0,
      path: (task.path || []).map((p: any) => p.toString()),
      assignedTo: (task.assigned_to || []).map((u: any) => ({
        id: u._id.toString(),
        fullName: u.full_name,
        username: u.username,
        telegramId: u.telegram_id,
      })),
      createdBy: task.created_by
        ? {
            id: task.created_by._id.toString(),
            fullName: task.created_by.full_name,
            username: task.created_by.username,
            telegramId: task.created_by.telegram_id,
          }
        : null,
      estimatedHours: task.estimated_hours,
      actualHours: task.actual_hours,
      completedAt: task.completed_at,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }))

    return NextResponse.json({ tasks: formattedTasks })
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}
