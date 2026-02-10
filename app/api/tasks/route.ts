import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User, Update, Project } from "@/lib/models"
import { taskTransformer } from "@/lib/transformers"
import { notificationService } from "@/lib/services"
import mongoose from "mongoose"

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

    // Get project details for notifications
    let projectName: string | undefined
    if (projectId) {
      const project = await Project.findById(projectId).lean()
      projectName = project?.name
    }

    // Send notifications to assigned users using centralized service
    if (assignedUsers.length > 0) {
      await notificationService.notifyTaskAssignment({
        assignedUsers,
        taskTitle: title,
        taskId: task._id.toString(),
        assignedBy: user.full_name,
        dueDate: new Date(dueDate),
        priority: priority || "medium",
        projectName,
        projectId,
        taskDescription: description,
        excludeTelegramId: telegramId,
      })
    }

    // Populate the task for a complete response
    const populatedTask = await Task.findById(task._id)
      .populate("assigned_to", "full_name username telegram_id")
      .populate("created_by", "full_name username telegram_id")
      .lean()

    return NextResponse.json({
      task: taskTransformer.toFrontend(populatedTask as any),
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

    console.log("[Tasks API] Query:", JSON.stringify(query, null, 2))

    const tasks = await Task.find(query)
      .populate("assigned_to", "full_name username telegram_id")
      .populate("created_by", "full_name username telegram_id")
      .sort({ due_date: 1 })
      .lean()

    console.log(`[Tasks API] Found ${tasks.length} tasks for query`)

    // Debug: Log first task's details
    if (tasks.length > 0) {
      const firstTask = tasks[0] as any
      console.log("[Tasks API] First task:", JSON.stringify({
        _id: firstTask._id?.toString(),
        title: firstTask.title,
        project_id: firstTask.project_id?.toString(),
        parent_task_id: firstTask.parent_task_id?.toString() || null,
        depth: firstTask.depth,
        assigned_to: firstTask.assigned_to?.map((a: any) => ({
          _id: a._id?.toString(),
          telegram_id: a.telegram_id,
          full_name: a.full_name
        }))
      }, null, 2))
    } else {
      console.log("[Tasks API] No tasks found!")
    }

    // Use centralized transformer instead of manual mapping
    const formattedTasks = taskTransformer.toList(tasks as any[])

    return NextResponse.json(
      { tasks: formattedTasks },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching tasks:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}
