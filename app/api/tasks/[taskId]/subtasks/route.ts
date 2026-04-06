import { type NextRequest, NextResponse } from "next/server"
import { db, tasks, users, taskAssignees } from "@/lib/db"
import { eq, inArray } from "drizzle-orm"
import { taskTransformer } from "@/lib/transformers"

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

async function fetchAssignees(taskIds: string[]) {
  if (taskIds.length === 0) return []
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

  return rows.map((r) => ({
    taskId: r.taskId,
    userId: r.userId,
    fullName: r.fullName,
    telegramId: r.telegramId,
    username: r.username ?? "",
  }))
}

// GET /api/tasks/{id}/subtasks - Get direct children of a task
export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const parentTask = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
    if (!parentTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Get all direct children
    const subtaskRows = await db
      .select()
      .from(tasks)
      .where(eq(tasks.parent_task_id, taskId))
      .orderBy(tasks.created_at)

    const taskIds = subtaskRows.map((t) => t.id)
    const assigneeRows = await fetchAssignees(taskIds)

    const subtaskDocs = subtaskRows.map((t) => toTaskDoc(t, assigneeRows))

    return NextResponse.json(
      { subtasks: taskTransformer.toList(subtaskDocs) },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("Error fetching subtasks:", error)
    return NextResponse.json({ error: "Failed to fetch subtasks" }, { status: 500 })
  }
}

// POST /api/tasks/{id}/subtasks - Create a subtask
export async function POST(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")
    const data = await request.json()

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const parentTask = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
    if (!parentTask) {
      return NextResponse.json({ error: "Parent task not found" }, { status: 404 })
    }

    // Enforce max depth of 10 levels
    if (parentTask.depth >= 10) {
      return NextResponse.json({ error: "Maximum nesting depth (10) exceeded" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Fetch parent's current assignees to use as default
    const parentAssigneeRows = await fetchAssignees([taskId])

    // Process assigned users
    const assignedUserIds: string[] = []
    if (data.assignedTo && Array.isArray(data.assignedTo) && data.assignedTo.length > 0) {
      for (const id of data.assignedTo) {
        let foundUser = await db.query.users.findFirst({ where: eq(users.id, id) }).catch(() => null)
        if (!foundUser) {
          foundUser = await db.query.users.findFirst({ where: eq(users.telegram_id, String(id)) })
        }
        if (foundUser) assignedUserIds.push(foundUser.id)
      }
    } else {
      // Default to parent's assignees
      assignedUserIds.push(...parentAssigneeRows.map((a) => a.userId))
    }

    // Build depth and materialized path
    const depth = parentTask.depth + 1
    const path = parentTask.path ? `${parentTask.path}/${parentTask.id}` : `/${parentTask.id}`

    const [subtask] = await db
      .insert(tasks)
      .values({
        title: data.title,
        description: data.description || "",
        due_date: new Date(data.dueDate || parentTask.due_date || new Date()),
        status: "pending",
        priority: data.priority || parentTask.priority,
        created_by: user.id,
        company_id: parentTask.company_id,
        project_id: parentTask.project_id,
        parent_task_id: parentTask.id,
        depth,
        path,
        category: data.category || parentTask.category || "",
        tags: data.tags || parentTask.tags || [],
        department: data.department || parentTask.department || "",
        estimated_hours: data.estimatedHours || 0,
      })
      .returning()

    // Insert assignees
    if (assignedUserIds.length > 0) {
      await db.insert(taskAssignees).values(
        assignedUserIds.map((uid) => ({ task_id: subtask.id, user_id: uid }))
      )
    }

    const subtaskAssigneeRows = await fetchAssignees([subtask.id])

    return NextResponse.json(
      {
        subtask: taskTransformer.toFrontend(toTaskDoc(subtask, subtaskAssigneeRows)),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating subtask:", error)
    return NextResponse.json({ error: "Failed to create subtask" }, { status: 500 })
  }
}
