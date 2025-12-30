import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, User } from "@/lib/models"
import mongoose from "mongoose"

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

    await connectToDatabase()

    const user = await User.findOne({ telegram_id: telegramId })
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
          let task: any = null
          if (mongoose.Types.ObjectId.isValid(taskId)) {
            task = await Task.findById(taskId)
          }

          if (!task) {
            task = await Task.findOne({ _id: taskId })
          }

          if (!task) {
            results.failed.push({ taskId, error: "Task not found" })
            continue
          }

          const updates: any = {}

          // Move to different project
          if (targetProjectId && targetProjectId !== task.project_id.toString()) {
            if (!mongoose.Types.ObjectId.isValid(targetProjectId)) {
              results.failed.push({ taskId, error: "Invalid target project ID" })
              continue
            }
            updates.project_id = new mongoose.Types.ObjectId(targetProjectId)
          }

          // Move to different parent (or make root task)
          if (targetParentId !== undefined) {
            if (targetParentId === null) {
              // Make it a root task
              updates.parent_task_id = null
              updates.depth = 0
              updates.path = []
            } else {
              // Move to new parent
              let parentTask: any = null
              if (mongoose.Types.ObjectId.isValid(targetParentId)) {
                parentTask = await Task.findById(targetParentId)
              }

              if (!parentTask) {
                results.failed.push({ taskId, error: "Parent task not found" })
                continue
              }

              // Prevent circular references
              if (
                parentTask._id.toString() === taskId ||
                parentTask.path.some((p: any) => p.toString() === taskId)
              ) {
                results.failed.push({ taskId, error: "Circular reference detected" })
                continue
              }

              // Enforce max depth
              if (parentTask.depth >= 10) {
                results.failed.push({ taskId, error: "Maximum nesting depth exceeded" })
                continue
              }

              updates.parent_task_id = parentTask._id
              updates.depth = parentTask.depth + 1
              updates.path = [...parentTask.path, parentTask._id]
            }
          }

          // Apply updates
          if (Object.keys(updates).length > 0) {
            await Task.updateOne({ _id: task._id }, { $set: updates })

            // If this task has children, update their paths and depths
            const hasChildren = await Task.exists({ parent_task_id: task._id })
            if (hasChildren) {
              await updateDescendantPaths(task._id, updates.depth || 0, updates.path || [])
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
async function updateDescendantPaths(
  taskId: mongoose.Types.ObjectId,
  newDepth: number,
  newPath: mongoose.Types.ObjectId[]
) {
  // Get all direct children
  const children = await Task.find({ parent_task_id: taskId })

  for (const child of children) {
    const childDepth = newDepth + 1
    const childPath = [...newPath, taskId]

    await Task.updateOne(
      { _id: child._id },
      {
        $set: {
          depth: childDepth,
          path: childPath,
        },
      }
    )

    // Recursively update this child's descendants
    const hasGrandchildren = await Task.exists({ parent_task_id: child._id })
    if (hasGrandchildren) {
      await updateDescendantPaths(child._id, childDepth, childPath)
    }
  }
}
