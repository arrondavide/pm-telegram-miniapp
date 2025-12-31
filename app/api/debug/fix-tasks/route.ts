import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task } from "@/lib/models"

// GET /api/debug/fix-tasks - Fix tasks with missing projectId
export async function GET() {
  try {
    await connectToDatabase()

    // Find all tasks without a project_id
    const brokenTasks = await Task.find({
      $or: [
        { project_id: null },
        { project_id: { $exists: false } }
      ]
    })

    console.log(`Found ${brokenTasks.length} tasks without projectId`)

    const results = []

    for (const task of brokenTasks) {
      // Try to find the correct project by looking at the company
      // For now, we'll need to manually set this or delete these tasks
      results.push({
        taskId: task._id.toString(),
        title: task.title,
        companyId: task.company_id?.toString(),
        status: 'missing_project_id'
      })
    }

    return NextResponse.json({
      success: true,
      message: `Found ${brokenTasks.length} tasks without projectId`,
      tasks: results,
      note: "These tasks need to be deleted or assigned to a project manually"
    })
  } catch (error) {
    console.error("Error fixing tasks:", error)
    return NextResponse.json({ error: "Failed to fix tasks" }, { status: 500 })
  }
}

// DELETE /api/debug/fix-tasks - Delete all tasks without projectId
export async function DELETE() {
  try {
    await connectToDatabase()

    const result = await Task.deleteMany({
      $or: [
        { project_id: null },
        { project_id: { $exists: false } }
      ]
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.deletedCount} tasks without projectId`
    })
  } catch (error) {
    console.error("Error deleting tasks:", error)
    return NextResponse.json({ error: "Failed to delete tasks" }, { status: 500 })
  }
}
