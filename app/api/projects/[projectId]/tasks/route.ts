import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Project, Task, User } from "@/lib/models"
import { taskTransformer } from "@/lib/transformers"
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

    // Auto-fix: Assign tasks without project_id to this project if they belong to the same company
    const fixResult = await Task.updateMany(
      {
        company_id: project.company_id,
        $or: [
          { project_id: null },
          { project_id: { $exists: false } }
        ]
      },
      {
        $set: { project_id: project._id }
      }
    )

    if (fixResult.modifiedCount > 0) {
      console.log(`[Auto-fix] Assigned ${fixResult.modifiedCount} orphan tasks to project ${project._id}`)
    }

    // Build query
    const query: any = { project_id: project._id }
    if (rootOnly) {
      query.$or = [{ parent_task_id: null }, { parent_task_id: { $exists: false } }]
    }

    // Get tasks
    const tasks = await Task.find(query)
      .populate("assigned_to", "telegram_id full_name username")
      .populate("created_by", "telegram_id full_name username")
      .sort({ createdAt: -1 })
      .lean()

    // Use centralized transformer
    if (hierarchy) {
      // Build tree structure
      const taskMap = new Map<string, any>()
      const rootTasks: any[] = []

      // First pass: transform and create task objects with children array
      tasks.forEach((task: any) => {
        const formattedTask: any = taskTransformer.toFrontend(task)
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
      // Return flat list using transformer
      return NextResponse.json({ tasks: taskTransformer.toList(tasks as any[]) })
    }
  } catch (error) {
    console.error("Error fetching project tasks:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}
