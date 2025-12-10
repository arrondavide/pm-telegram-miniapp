import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User, Update } from "@/lib/models"
import mongoose from "mongoose"

// ... existing GET code ...

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      companyId,
      title,
      description,
      dueDate,
      priority,
      assignedTo,
      category,
      tags,
      department,
      subtasks,
      estimatedHours,
    } = body
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
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

    const task = await Task.create({
      title,
      description: description || "",
      due_date: new Date(dueDate),
      status: "pending",
      priority: priority || "medium",
      assigned_to: assignedUserIds,
      created_by: user._id,
      company_id: new mongoose.Types.ObjectId(companyId),
      category: category || "",
      tags: tags || [],
      department: department || "",
      subtasks: (subtasks || []).map((st: any) => ({
        title: st.title || st,
        completed: false,
      })),
      estimated_hours: estimatedHours || 0,
    })

    // Create activity log
    await Update.create({
      task_id: task._id,
      user_id: user._id,
      action: "created",
      message: `Task "${title}" created`,
    })

    const BOT_TOKEN = process.env.BOT_TOKEN
    if (BOT_TOKEN && assignedUsers.length > 0) {
      const formattedDate = new Date(dueDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })

      for (const assignedUser of assignedUsers) {
        // Don't notify the creator if they assigned themselves
        if (assignedUser.telegram_id === telegramId) continue

        const message = `📋 <b>New Task Assigned</b>\n\n<b>${title}</b>\n\nAssigned by: ${user.full_name}\nDue: ${formattedDate}\nPriority: ${priority || "medium"}\n\nOpen the app to view details.`

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

// ... existing GET code stays the same ...
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const status = searchParams.get("status")
    const priority = searchParams.get("priority")
    const assignedTo = searchParams.get("assignedTo")

    if (!companyId) {
      return NextResponse.json({ error: "Company ID required" }, { status: 400 })
    }

    await connectToDatabase()

    const query: any = { company_id: new mongoose.Types.ObjectId(companyId) }

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
      subtasks: (task.subtasks || []).map((st: any, idx: number) => ({
        id: st._id?.toString() || `subtask-${idx}`,
        title: st.title,
        completed: st.completed,
        completedAt: st.completed_at,
      })),
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
