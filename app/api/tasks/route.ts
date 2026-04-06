import { type NextRequest, NextResponse } from "next/server"
import { db, tasks, users, taskAssignees, taskUpdates, projects } from "@/lib/db"
import { eq, and, isNull, inArray } from "drizzle-orm"
import { taskTransformer } from "@/lib/transformers"
import { notificationService } from "@/lib/services"

/** Build the shape the transformer expects from a Drizzle task row + assignee rows */
function toTaskDoc(
  task: any,
  assigneeRows: Array<{ taskId: string; userId: string; fullName: string; telegramId: string; username: string }>
) {
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

    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Resolve assignee user IDs and collect user info for notifications
    const assignedUserIds: string[] = []
    const assignedUsers: any[] = []

    if (assignedTo && Array.isArray(assignedTo)) {
      for (const id of assignedTo) {
        // Try by UUID first, then by telegram_id
        let foundUser = await db.query.users.findFirst({ where: eq(users.id, id) }).catch(() => null)
        if (!foundUser) {
          foundUser = await db.query.users.findFirst({ where: eq(users.telegram_id, String(id)) })
        }
        if (foundUser) {
          assignedUserIds.push(foundUser.id)
          assignedUsers.push(foundUser)
        }
      }
    }

    // Calculate depth and path from parent
    let depth = 0
    let path = ""
    let parentTask: any = null

    if (parentTaskId) {
      parentTask = await db.query.tasks.findFirst({ where: eq(tasks.id, parentTaskId) })
      if (!parentTask) {
        return NextResponse.json({ error: "Parent task not found" }, { status: 404 })
      }

      // Enforce max depth of 10 levels
      if (parentTask.depth >= 10) {
        return NextResponse.json({ error: "Maximum nesting depth (10) exceeded" }, { status: 400 })
      }

      depth = parentTask.depth + 1
      // Build materialized path: parent's path + parent's id
      path = parentTask.path ? `${parentTask.path}/${parentTask.id}` : `/${parentTask.id}`
    }

    const [task] = await db
      .insert(tasks)
      .values({
        title,
        description: description || "",
        due_date: new Date(dueDate),
        status: "pending",
        priority: priority || "medium",
        created_by: user.id,
        company_id: companyId,
        project_id: projectId,
        parent_task_id: parentTaskId || null,
        depth,
        path,
        category: category || "",
        tags: tags || [],
        department: department || "",
        estimated_hours: estimatedHours || 0,
      })
      .returning()

    // Insert task assignees
    if (assignedUserIds.length > 0) {
      await db.insert(taskAssignees).values(
        assignedUserIds.map((uid) => ({ task_id: task.id, user_id: uid }))
      )
    }

    // Create activity log
    await db.insert(taskUpdates).values({
      task_id: task.id,
      user_id: user.id,
      action: "created",
      message: `Task "${title}" created`,
    })

    // Get project details for notifications
    let projectName: string | undefined
    if (projectId) {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
      projectName = project?.name
    }

    // Send notifications to assigned users
    if (assignedUsers.length > 0) {
      await notificationService.notifyTaskAssignment({
        assignedUsers,
        taskTitle: title,
        taskId: task.id,
        assignedBy: user.full_name,
        dueDate: new Date(dueDate),
        priority: priority || "medium",
        projectName,
        projectId,
        taskDescription: description,
        excludeTelegramId: telegramId,
      })
    }

    // Build response doc
    const assigneeRows = assignedUsers.map((u) => ({
      taskId: task.id,
      userId: u.id,
      fullName: u.full_name,
      telegramId: u.telegram_id,
      username: u.username ?? "",
    }))

    return NextResponse.json({
      task: taskTransformer.toFrontend(toTaskDoc(task, assigneeRows)),
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

    // Build conditions
    const conditions: any[] = [eq(tasks.company_id, companyId)]

    if (projectId) {
      conditions.push(eq(tasks.project_id, projectId))
    }

    if (rootOnly) {
      conditions.push(isNull(tasks.parent_task_id))
    } else if (parentTaskId) {
      conditions.push(eq(tasks.parent_task_id, parentTaskId))
    }

    if (status && status !== "all") {
      conditions.push(eq(tasks.status, status as any))
    }
    if (priority && priority !== "all") {
      conditions.push(eq(tasks.priority, priority as any))
    }

    console.log("[Tasks API] Query conditions count:", conditions.length)

    let taskRows: any[]

    if (assignedTo) {
      // Filter by assignee via join
      const assignedTaskIds = await db
        .select({ task_id: taskAssignees.task_id })
        .from(taskAssignees)
        .where(eq(taskAssignees.user_id, assignedTo))

      const ids = assignedTaskIds.map((r) => r.task_id)
      if (ids.length === 0) {
        taskRows = []
      } else {
        conditions.push(inArray(tasks.id, ids))
        taskRows = await db
          .select()
          .from(tasks)
          .where(and(...conditions))
          .orderBy(tasks.due_date)
      }
    } else {
      taskRows = await db
        .select()
        .from(tasks)
        .where(and(...conditions))
        .orderBy(tasks.due_date)
    }

    console.log(`[Tasks API] Found ${taskRows.length} tasks for query`)

    if (taskRows.length > 0) {
      const firstTask = taskRows[0]
      console.log("[Tasks API] First task:", JSON.stringify({
        id: firstTask.id,
        title: firstTask.title,
        project_id: firstTask.project_id,
        parent_task_id: firstTask.parent_task_id,
        depth: firstTask.depth,
      }, null, 2))
    } else {
      console.log("[Tasks API] No tasks found!")
    }

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
    const formattedTasks = taskTransformer.toList(taskDocs)

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
