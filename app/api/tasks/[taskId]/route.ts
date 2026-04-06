import { type NextRequest, NextResponse } from "next/server"
import { db, tasks, users, taskAssignees, taskUpdates, projects } from "@/lib/db"
import { eq, inArray } from "drizzle-orm"
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

async function getTaskAssignees(taskId: string) {
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
    .where(eq(taskAssignees.task_id, taskId))

  return rows.map((r) => ({
    taskId: r.taskId,
    userId: r.userId,
    fullName: r.fullName,
    telegramId: r.telegramId,
    username: r.username ?? "",
  }))
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params
    console.log("[Task API GET] Fetching task:", taskId)

    if (!taskId) {
      return NextResponse.json({ error: "Invalid task ID format" }, { status: 400 })
    }

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })

    if (!task) {
      console.log("[Task API GET] Task not found in database:", taskId)
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    console.log("[Task API GET] Task found:", task.id, task.title)

    const assigneeRows = await getTaskAssignees(taskId)
    const transformedTask = taskTransformer.toFrontend(toTaskDoc(task, assigneeRows))
    console.log("[Task API GET] Transformed task id:", transformedTask.id)

    return NextResponse.json(
      { task: transformedTask },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (error) {
    console.error("[Task API GET] Error fetching task:", error)
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

    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const oldStatus = task.status

    // Fetch current assignees for notification comparison
    const currentAssigneeRows = await getTaskAssignees(taskId)
    const oldAssigneeTelegramIds = new Set(currentAssigneeRows.map((a) => a.telegramId))

    // Build update payload
    const updateData: Record<string, any> = { updated_at: new Date() }
    if (body.title !== undefined) updateData.title = body.title
    if (body.description !== undefined) updateData.description = body.description
    if (body.dueDate !== undefined) updateData.due_date = new Date(body.dueDate)
    if (body.status !== undefined) {
      updateData.status = body.status
      if (body.status === "completed") {
        updateData.completed_at = new Date()
      }
    }
    if (body.priority !== undefined) updateData.priority = body.priority
    if (body.category !== undefined) updateData.category = body.category
    if (body.tags !== undefined) updateData.tags = body.tags

    // Handle assignedTo updates
    let newAssigneeRows: typeof currentAssigneeRows = currentAssigneeRows
    if (body.assignedTo !== undefined) {
      // Resolve new assignee IDs
      const resolvedAssignees: any[] = []
      for (const id of body.assignedTo) {
        let foundUser = await db.query.users.findFirst({ where: eq(users.id, id) }).catch(() => null)
        if (!foundUser) {
          foundUser = await db.query.users.findFirst({ where: eq(users.telegram_id, String(id)) })
        }
        if (foundUser) resolvedAssignees.push(foundUser)
      }

      // Replace assignees
      await db.delete(taskAssignees).where(eq(taskAssignees.task_id, taskId))
      if (resolvedAssignees.length > 0) {
        await db.insert(taskAssignees).values(
          resolvedAssignees.map((u) => ({ task_id: taskId, user_id: u.id }))
        )
      }

      newAssigneeRows = resolvedAssignees.map((u) => ({
        taskId,
        userId: u.id,
        fullName: u.full_name,
        telegramId: u.telegram_id,
        username: u.username ?? "",
      }))

      // Send assignment notifications to newly assigned users
      const newlyAssignedUsers = resolvedAssignees.filter(
        (u) => !oldAssigneeTelegramIds.has(u.telegram_id) && u.telegram_id !== telegramId
      )

      if (newlyAssignedUsers.length > 0) {
        let projectName: string | undefined
        let projectId: string | undefined
        if (task.project_id) {
          const project = await db.query.projects.findFirst({ where: eq(projects.id, task.project_id) })
          projectName = project?.name
          projectId = project?.id
        }

        console.log("[Task PATCH] Sending assignment notifications to:", newlyAssignedUsers.map((u) => u.telegram_id))
        await notificationService.notifyTaskAssignment({
          assignedUsers: newlyAssignedUsers.map((u) => ({ telegram_id: u.telegram_id, full_name: u.full_name })),
          taskTitle: task.title,
          taskId: task.id,
          assignedBy: user.full_name,
          dueDate: task.due_date || new Date(),
          priority: task.priority,
          projectName,
          projectId,
          taskDescription: task.description,
          excludeTelegramId: telegramId,
        })
      }
    }

    const [updatedTask] = await db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, taskId))
      .returning()

    console.log("[Task PATCH] Task updated:", {
      taskId: updatedTask.id,
      title: updatedTask.title,
      assigned_to: newAssigneeRows.map((a) => ({ id: a.userId, telegram_id: a.telegramId })),
    })

    // Log status change and send notifications
    if (body.status && body.status !== oldStatus) {
      await db.insert(taskUpdates).values({
        task_id: taskId,
        user_id: user.id,
        action: "status_changed",
        old_value: oldStatus,
        new_value: body.status,
        message: `Status changed from ${oldStatus} to ${body.status}`,
      })

      let projectName: string | undefined
      let projectId: string | undefined
      if (updatedTask.project_id) {
        const project = await db.query.projects.findFirst({ where: eq(projects.id, updatedTask.project_id) })
        projectName = project?.name
        projectId = project?.id
      }

      const peopleToNotify = new Map<string, { telegramId: string; fullName: string }>()

      // Add all assigned users
      for (const a of newAssigneeRows) {
        if (a.telegramId && a.telegramId !== telegramId) {
          peopleToNotify.set(a.telegramId, { telegramId: a.telegramId, fullName: a.fullName || "User" })
        }
      }

      // Add task creator
      if (updatedTask.created_by) {
        const creator = await db.query.users.findFirst({ where: eq(users.id, updatedTask.created_by) })
        if (creator?.telegram_id && creator.telegram_id !== telegramId) {
          peopleToNotify.set(creator.telegram_id, {
            telegramId: creator.telegram_id,
            fullName: creator.full_name || "User",
          })
        }
      }

      console.log("[Task PATCH] Status changed from", oldStatus, "to", body.status)
      console.log("[Task PATCH] People to notify for status change:", Array.from(peopleToNotify.keys()))
      console.log("[Task PATCH] Changed by (excluded):", telegramId)

      for (const [notifyTelegramId, recipient] of peopleToNotify) {
        console.log("[Task PATCH] Sending status notification to:", notifyTelegramId)
        if (body.status === "completed") {
          await notificationService.notifyTaskCompleted({
            telegramId: notifyTelegramId,
            recipientName: recipient.fullName,
            taskTitle: updatedTask.title,
            taskId: updatedTask.id,
            completedBy: user.full_name,
            completedByTelegramId: telegramId,
            projectName,
            projectId,
          })
        } else {
          await notificationService.notifyTaskStatusChange({
            telegramId: notifyTelegramId,
            recipientName: recipient.fullName,
            taskTitle: updatedTask.title,
            taskId: updatedTask.id,
            oldStatus,
            newStatus: body.status,
            changedBy: user.full_name,
            changedByTelegramId: telegramId,
            projectName,
            projectId,
          })
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

    await db.delete(tasks).where(eq(tasks.id, taskId))

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting task:", error)
    return NextResponse.json({ error: "Failed to delete task" }, { status: 500 })
  }
}
