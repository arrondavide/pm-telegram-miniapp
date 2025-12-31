import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Project, Task, User } from "@/lib/models"
import mongoose from "mongoose"

// GET /api/projects/{id}/tasks?hierarchy=true&rootOnly=true
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const { searchParams } = new URL(request.url)
    const telegramId = request.headers.get("X-Telegram-Id")
    const hierarchy = searchParams.get("hierarchy") === "true"
    const rootOnly = searchParams.get("rootOnly") === "true"

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Get the project
    let project: any = null
    if (mongoose.Types.ObjectId.isValid(projectId)) {
      project = await Project.findById(projectId)
    }

    if (!project) {
      project = await Project.findOne({ _id: projectId })
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user has access
    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const hasAccess = user.companies.some(
      (c: any) => c.company_id.toString() === project.company_id.toString()
    )

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Build query
    const query: any = { project_id: project._id }
    if (rootOnly) {
      query.$or = [{ parent_task_id: null }, { parent_task_id: { $exists: false } }]
    }

    console.log('[API] Fetching tasks with query:', JSON.stringify(query))
    console.log('[API] Project ID:', project._id.toString())
    console.log('[API] rootOnly:', rootOnly)

    // Get tasks
    const tasks = await Task.find(query)
      .populate("assigned_to", "telegram_id full_name username")
      .populate("created_by", "telegram_id full_name username")
      .sort({ createdAt: -1 })
      .lean()

    console.log('[API] Found tasks count:', tasks.length)
    if (tasks.length > 0) {
      console.log('[API] Sample task:', {
        id: tasks[0]._id.toString(),
        title: tasks[0].title,
        project_id: tasks[0].project_id?.toString(),
        assignedTo: tasks[0].assigned_to
      })
    }

    // Also check for ALL tasks in this project (ignoring rootOnly)
    const allTasksInProject = await Task.find({ project_id: project._id }).lean()
    console.log('[API] Total tasks in project (ignoring rootOnly):', allTasksInProject.length)

    // Check for tasks with missing project_id
    const tasksWithoutProject = await Task.find({
      $or: [
        { project_id: null },
        { project_id: { $exists: false } }
      ]
    }).limit(5).lean()
    console.log('[API] Tasks without project_id:', tasksWithoutProject.length)
    if (tasksWithoutProject.length > 0) {
      console.log('[API] Sample task without project_id:', {
        id: tasksWithoutProject[0]._id.toString(),
        title: tasksWithoutProject[0].title,
        company_id: tasksWithoutProject[0].company_id?.toString()
      })
    }

    // Format tasks
    const formatTask = (task: any) => ({
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
      dependsOn: (task.depends_on || []).map((d: any) => d.toString()),
      isRecurring: task.is_recurring || false,
      recurrence: task.recurrence || null,
      parentRecurringTask: task.parent_recurring_task?.toString() || null,
      estimatedHours: task.estimated_hours || 0,
      actualHours: task.actual_hours || 0,
      attachments: task.attachments || [],
      completedAt: task.completed_at?.toISOString() || null,
      cancelledAt: task.cancelled_at?.toISOString() || null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })

    if (hierarchy) {
      // Build tree structure
      const taskMap = new Map<string, any>()
      const rootTasks: any[] = []

      // First pass: create task objects with children array
      tasks.forEach((task: any) => {
        const formattedTask: any = formatTask(task)
        formattedTask.children = []
        taskMap.set(formattedTask.id, formattedTask)
      })

      // Second pass: build tree
      tasks.forEach((task: any) => {
        const formattedTask = taskMap.get(task._id.toString())
        if (task.parent_task_id) {
          const parent = taskMap.get(task.parent_task_id.toString())
          if (parent) {
            parent.children.push(formattedTask)
          } else {
            // Parent not in result set, add to root
            rootTasks.push(formattedTask)
          }
        } else {
          rootTasks.push(formattedTask)
        }
      })

      return NextResponse.json({ tasks: rootTasks })
    } else {
      // Return flat list
      return NextResponse.json({ tasks: tasks.map(formatTask) })
    }
  } catch (error) {
    console.error("Error fetching project tasks:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}
