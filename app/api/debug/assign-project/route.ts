import { NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Task, Project } from "@/lib/models"
import mongoose from "mongoose"

// GET /api/debug/assign-project - Show tasks and projects, and assign tasks to first project
export async function GET() {
  try {
    await connectToDatabase()

    // Find all tasks without a project_id
    const brokenTasks = await Task.find({
      $or: [
        { project_id: null },
        { project_id: { $exists: false } }
      ]
    }).lean()

    // Find all projects
    const projects = await Project.find().lean()

    console.log(`Found ${brokenTasks.length} tasks without projectId`)
    console.log(`Found ${projects.length} projects`)

    const results = {
      tasksWithoutProject: brokenTasks.map(t => ({
        id: t._id.toString(),
        title: t.title,
        companyId: t.company_id?.toString()
      })),
      projects: projects.map(p => ({
        id: p._id.toString(),
        name: p.name,
        companyId: p.company_id.toString()
      }))
    }

    return NextResponse.json({
      success: true,
      message: `Found ${brokenTasks.length} tasks without projectId and ${projects.length} projects`,
      data: results
    })
  } catch (error) {
    console.error("Error:", error)
    return NextResponse.json({ error: "Failed to check tasks" }, { status: 500 })
  }
}

// POST /api/debug/assign-project - Assign all broken tasks to a specific project
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 })
    }

    await connectToDatabase()

    // Verify project exists
    const project = await Project.findById(projectId)
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Update all tasks without project_id to use this project
    const result = await Task.updateMany(
      {
        $or: [
          { project_id: null },
          { project_id: { $exists: false } }
        ],
        company_id: project.company_id // Only update tasks from same company
      },
      {
        $set: { project_id: new mongoose.Types.ObjectId(projectId) }
      }
    )

    console.log(`Updated ${result.modifiedCount} tasks to project ${projectId}`)

    return NextResponse.json({
      success: true,
      message: `Assigned ${result.modifiedCount} tasks to project "${project.name}"`,
      modifiedCount: result.modifiedCount
    })
  } catch (error) {
    console.error("Error assigning project:", error)
    return NextResponse.json({ error: "Failed to assign project" }, { status: 500 })
  }
}
