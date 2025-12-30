import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Project, User, Task } from "@/lib/models"
import mongoose from "mongoose"

// GET /api/projects/{id}
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Get the project
    let project: any = null
    if (mongoose.Types.ObjectId.isValid(projectId)) {
      project = await Project.findById(projectId).populate("created_by", "telegram_id full_name username").lean()
    }

    if (!project) {
      project = await Project.findOne({ _id: projectId })
        .populate("created_by", "telegram_id full_name username")
        .lean()
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user has access to this project's company
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

    return NextResponse.json({
      project: {
        id: project._id.toString(),
        name: project.name,
        description: project.description || "",
        companyId: project.company_id.toString(),
        status: project.status,
        createdBy: {
          id: project.created_by?._id?.toString() || "",
          fullName: project.created_by?.full_name || "Unknown",
          username: project.created_by?.username || "",
          telegramId: project.created_by?.telegram_id || "",
        },
        color: project.color || "#3b82f6",
        icon: project.icon || "📁",
        startDate: project.start_date?.toISOString() || null,
        targetEndDate: project.target_end_date?.toISOString() || null,
        completedAt: project.completed_at?.toISOString() || null,
        archivedAt: project.archived_at?.toISOString() || null,
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 })
  }
}

// PATCH /api/projects/{id}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const data = await request.json()
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

    // Verify user has access and permissions
    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const companyAccess = user.companies.find(
      (c: any) => c.company_id.toString() === project.company_id.toString()
    )

    if (!companyAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only admins and managers can update projects
    if (!["admin", "manager"].includes(companyAccess.role)) {
      return NextResponse.json({ error: "Only admins and managers can update projects" }, { status: 403 })
    }

    // Update the project
    const updateData: any = {}
    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description
    if (data.status !== undefined) {
      updateData.status = data.status
      if (data.status === "completed" && !project.completed_at) {
        updateData.completed_at = new Date()
      }
      if (data.status === "archived" && !project.archived_at) {
        updateData.archived_at = new Date()
      }
    }
    if (data.color !== undefined) updateData.color = data.color
    if (data.icon !== undefined) updateData.icon = data.icon
    if (data.startDate !== undefined) updateData.start_date = data.startDate ? new Date(data.startDate) : null
    if (data.targetEndDate !== undefined) updateData.target_end_date = data.targetEndDate ? new Date(data.targetEndDate) : null

    await Project.updateOne({ _id: project._id }, { $set: updateData })

    const updatedProject = await Project.findById(project._id)
      .populate("created_by", "telegram_id full_name username")
      .lean()

    return NextResponse.json({
      project: {
        id: updatedProject!._id.toString(),
        name: updatedProject!.name,
        description: updatedProject!.description || "",
        companyId: updatedProject!.company_id.toString(),
        status: updatedProject!.status,
        createdBy: {
          id: (updatedProject!.created_by as any)?._id?.toString() || "",
          fullName: (updatedProject!.created_by as any)?.full_name || "Unknown",
          username: (updatedProject!.created_by as any)?.username || "",
          telegramId: (updatedProject!.created_by as any)?.telegram_id || "",
        },
        color: updatedProject!.color || "#3b82f6",
        icon: updatedProject!.icon || "📁",
        startDate: updatedProject!.start_date?.toISOString() || null,
        targetEndDate: updatedProject!.target_end_date?.toISOString() || null,
        completedAt: updatedProject!.completed_at?.toISOString() || null,
        archivedAt: updatedProject!.archived_at?.toISOString() || null,
        createdAt: (updatedProject as any)!.createdAt.toISOString(),
        updatedAt: (updatedProject as any)!.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("Error updating project:", error)
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 })
  }
}

// DELETE /api/projects/{id}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")
    const { searchParams } = new URL(request.url)
    const force = searchParams.get("force") === "true"

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

    // Verify user has access and permissions
    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const companyAccess = user.companies.find(
      (c: any) => c.company_id.toString() === project.company_id.toString()
    )

    if (!companyAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only admins can delete projects
    if (companyAccess.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete projects" }, { status: 403 })
    }

    // Check if project has tasks
    const taskCount = await Task.countDocuments({ project_id: project._id })

    if (taskCount > 0 && !force) {
      return NextResponse.json(
        {
          error: "Project has tasks",
          message: `This project has ${taskCount} tasks. Archive the project instead, or use force=true to delete all tasks.`,
          taskCount,
        },
        { status: 400 }
      )
    }

    // Delete all tasks if force is true
    if (force && taskCount > 0) {
      await Task.deleteMany({ project_id: project._id })
    }

    // Delete the project
    await Project.deleteOne({ _id: project._id })

    return NextResponse.json({
      message: "Project deleted successfully",
      deletedTasks: force ? taskCount : 0,
    })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
