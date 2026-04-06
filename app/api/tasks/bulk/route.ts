import { type NextRequest, NextResponse } from "next/server"
import { db, tasks, users } from "@/lib/db"
import { eq } from "drizzle-orm"

// POST /api/tasks/bulk/move - Move tasks between projects/parents
export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("X-Telegram-Id")
    const data = await request.json()
    const { action, taskIds, targetProjectId, targetParentId } = data

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    if (!action) {
      return NextResponse.json({ error: "Action required" }, { status: 400 })
    }

    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (action === "move") {
      if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
        return NextResponse.json({ error: "Task IDs required" }, { status: 400 })
      }

      const results = {
        success: [] as string[],
        failed: [] as { taskId: string; error: string }[],
      }

      for (const taskId of taskIds) {
        try {
          const task = await db.query.tasks.findFirst({ where: eq(tasks.id, taskId) })

          if (!task) {
            results.failed.push({ taskId, error: "Task not found" })
            continue
          }

          const updates: Record<string, any> = { updated_at: new Date() }

          // Move to different project
          if (targetProjectId && targetProjectId !== task.project_id) {
            updates.project_id = targetProjectId
          }

          // Move to different parent (or make root task)
          if (targetParentId !== undefined) {
            if (targetParentId === null) {
              // Make it a root task
              updates.parent_task_id = null
              updates.depth = 0
              updates.path = ""
            } else {
              // Move to new parent
              const parentTask = await db.query.tasks.findFirst({ where: eq(tasks.id, targetParentId) })

              if (!parentTask) {
                results.failed.push({ taskId, error: "Parent task not found" })
                continue
              }

              // Prevent circular references - check if target parent is a descendant of this task
              const parentPath = parentTask.path || ""
              if (
                parentTask.id === taskId ||
                parentPath.split("/").filter(Boolean).includes(taskId)
              ) {
                results.failed.push({ taskId, error: "Circular reference detected" })
                continue
              }

              // Enforce max depth
              if (parentTask.depth >= 10) {
                results.failed.push({ taskId, error: "Maximum nesting depth exceeded" })
                continue
              }

              updates.parent_task_id = parentTask.id
              updates.depth = parentTask.depth + 1
              updates.path = parentTask.path ? `${parentTask.path}/${parentTask.id}` : `/${parentTask.id}`
            }
          }

          // Apply updates
          if (Object.keys(updates).length > 1) { // more than just updated_at
            await db.update(tasks).set(updates).where(eq(tasks.id, task.id))

            // If this task has children, update their paths and depths
            const children = await db.select().from(tasks).where(eq(tasks.parent_task_id, task.id))
            if (children.length > 0) {
              await updateDescendantPaths(task.id, updates.depth ?? task.depth, updates.path ?? task.path ?? "")
            }

            results.success.push(taskId)
          } else {
            results.failed.push({ taskId, error: "No changes specified" })
          }
        } catch (error: any) {
          results.failed.push({ taskId, error: error.message || "Unknown error" })
        }
      }

      return NextResponse.json({
        message: `Moved ${results.success.length} tasks successfully`,
        results,
      })
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }
  } catch (error) {
    console.error("Error in bulk operation:", error)
    return NextResponse.json({ error: "Bulk operation failed" }, { status: 500 })
  }
}

// Helper function to update all descendants when a task is moved
async function updateDescendantPaths(taskId: string, newDepth: number, newPath: string) {
  // Get all direct children
  const children = await db.select().from(tasks).where(eq(tasks.parent_task_id, taskId))

  for (const child of children) {
    const childDepth = newDepth + 1
    const childPath = newPath ? `${newPath}/${taskId}` : `/${taskId}`

    await db.update(tasks).set({
      depth: childDepth,
      path: childPath,
      updated_at: new Date(),
    }).where(eq(tasks.id, child.id))

    // Recursively update this child's descendants
    const grandchildren = await db.select().from(tasks).where(eq(tasks.parent_task_id, child.id))
    if (grandchildren.length > 0) {
      await updateDescendantPaths(child.id, childDepth, childPath)
    }
  }
}
