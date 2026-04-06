import { type NextRequest, NextResponse } from "next/server"
import { db, tasks, users, taskAssignees } from "@/lib/db"
import { eq, sql, inArray, asc } from "drizzle-orm"
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

// GET /api/tasks/{id}/descendants - Get all descendants (recursive)
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

    // Get all descendants - tasks whose materialized path contains this task's ID
    // Path format: "/grandparent-id/parent-id" - we look for "/<taskId>" anywhere in path
    const descendants = await db
      .select()
      .from(tasks)
      .where(sql`${tasks.path} LIKE ${"%" + "/" + taskId + "%"}`)
      .orderBy(asc(tasks.depth), tasks.created_at)

    const taskIds = descendants.map((t) => t.id)
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

    const descendantDocs = descendants.map((t) => toTaskDoc(t, assigneeRows))
    const formattedDescendants = taskTransformer.toList(descendantDocs)

    return NextResponse.json({
      descendants: formattedDescendants,
      count: formattedDescendants.length,
    })
  } catch (error) {
    console.error("Error fetching descendants:", error)
    return NextResponse.json({ error: "Failed to fetch descendants" }, { status: 500 })
  }
}
