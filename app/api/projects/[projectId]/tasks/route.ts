import { type NextRequest, NextResponse } from "next/server"
import { db, projects, tasks, users, userCompanies, taskAssignees } from "@/lib/db"
import { eq, and, isNull, inArray } from "drizzle-orm"
import { taskTransformer } from "@/lib/transformers"

/** Map a Drizzle task row + assignee rows into the shape the transformer expects */
function toTaskDoc(task: any, assigneeRows: Array<{ taskId: string; userId: string; fullName: string; telegramId: string; username: string }>) {
  const myAssignees = assigneeRows
    .filter((a) => a.taskId === task.id)
    .map((a) => ({
      _id: { toString: () => a.userId },
      telegram_id: a.telegramId,
      full_name: a.fullName,
      username: a.username,
    }))

  return {
    _id: { toString: () => task.id },
    title: task.title,
    description: task.description ?? "",
    due_date: task.due_date ?? new Date(),
    status: task.status,
    priority: task.priority,
    assigned_to: myAssignees,
    created_by: task.created_by ?? "",
    company_id: task.company_id,
    project_id: task.project_id ?? "",
    parent_task_id: task.parent_task_id ?? null,
    depth: task.depth ?? 0,
    path: task.path ? task.path.split("/").filter(Boolean) : [],
    category: task.category ?? "",
    tags: task.tags ?? [],
    department: task.department ?? "",
    estimated_hours: task.estimated_hours ?? 0,
    actual_hours: task.actual_hours ?? 0,
    completed_at: task.completed_at ?? undefined,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  } as any
}

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

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user has access
    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const access = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, project.company_id)),
    })

    if (!access) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Build query conditions
    const conditions = rootOnly
      ? and(eq(tasks.project_id, projectId), isNull(tasks.parent_task_id))
      : eq(tasks.project_id, projectId)

    const taskRows = await db
      .select()
      .from(tasks)
      .where(conditions)
      .orderBy(tasks.created_at)

    // Fetch assignees for all tasks
    const taskIds = taskRows.map((t) => t.id)
    let assigneeRows: Array<{ taskId: string; userId: string; fullName: string; telegramId: string; username: string }> = []

    if (taskIds.length > 0) {
      const rows = await db
        .select({
          taskId: taskAssignees.task_id,
          userId: users.id,
          fullName: users.full_name,
          telegramId: users.telegram_id,
          username: users.username,
        })
        .from(taskAssignees)
        .innerJoin(users, eq(taskAssignees.user_id, users.id))
        .where(inArray(taskAssignees.task_id, taskIds))

      assigneeRows = rows.map((r) => ({
        taskId: r.taskId,
        userId: r.userId,
        fullName: r.fullName,
        telegramId: r.telegramId,
        username: r.username ?? "",
      }))
    }

    const taskDocs = taskRows.map((t) => toTaskDoc(t, assigneeRows))

    if (hierarchy) {
      // Build tree structure
      const taskMap = new Map<string, any>()
      const rootTasks: any[] = []

      // First pass: transform and create task objects with children array
      taskDocs.forEach((doc: any) => {
        const formattedTask: any = taskTransformer.toFrontend(doc)
        formattedTask.children = []
        taskMap.set(formattedTask.id, formattedTask)
      })

      // Second pass: build tree
      taskRows.forEach((task) => {
        const formattedTask = taskMap.get(task.id)
        if (task.parent_task_id) {
          const parent = taskMap.get(task.parent_task_id)
          if (parent) {
            parent.children.push(formattedTask)
          } else {
            rootTasks.push(formattedTask)
          }
        } else {
          rootTasks.push(formattedTask)
        }
      })

      return NextResponse.json({ tasks: rootTasks })
    } else {
      return NextResponse.json({ tasks: taskTransformer.toList(taskDocs) })
    }
  } catch (error) {
    console.error("Error fetching project tasks:", error)
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 })
  }
}
