import { type NextRequest, NextResponse } from "next/server"
import { db, projects, users, userCompanies, tasks } from "@/lib/db"
import { eq, and, count } from "drizzle-orm"
import { projectTransformer } from "@/lib/transformers"

function toProjectDoc(p: any, creatorUser?: any) {
  return {
    _id: { toString: () => p.id },
    name: p.name,
    description: p.description ?? "",
    company_id: p.company_id,
    status: p.status,
    created_by: creatorUser
      ? { _id: { toString: () => creatorUser.id }, telegram_id: creatorUser.telegram_id, full_name: creatorUser.full_name, username: creatorUser.username ?? "" }
      : p.created_by ?? "",
    color: p.color ?? "#3b82f6",
    icon: p.icon ?? "📁",
    start_date: p.start_date ?? undefined,
    target_end_date: p.target_end_date ?? undefined,
    completed_at: p.completed_at ?? undefined,
    archived_at: p.archived_at ?? undefined,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  } as any
}

// GET /api/projects/{id}
export async function GET(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user has access to this project's company
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

    let creatorUser: any = null
    if (project.created_by) {
      creatorUser = await db.query.users.findFirst({ where: eq(users.id, project.created_by) })
    }

    return NextResponse.json({
      project: projectTransformer.toFrontend(toProjectDoc(project, creatorUser)),
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

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user has access and permissions
    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const companyAccess = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, project.company_id)),
    })

    if (!companyAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only admins and managers can update projects
    if (!["admin", "manager"].includes(companyAccess.role)) {
      return NextResponse.json({ error: "Only admins and managers can update projects" }, { status: 403 })
    }

    // Build update data
    const updateData: Record<string, any> = { updated_at: new Date() }
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

    const [updatedProject] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, projectId))
      .returning()

    let creatorUser: any = null
    if (updatedProject.created_by) {
      creatorUser = await db.query.users.findFirst({ where: eq(users.id, updatedProject.created_by) })
    }

    return NextResponse.json({
      project: projectTransformer.toFrontend(toProjectDoc(updatedProject, creatorUser)),
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

    const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Verify user has access and permissions
    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const companyAccess = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, project.company_id)),
    })

    if (!companyAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only admins can delete projects
    if (companyAccess.role !== "admin") {
      return NextResponse.json({ error: "Only admins can delete projects" }, { status: 403 })
    }

    // Check if project has tasks
    const [{ value: taskCount }] = await db
      .select({ value: count() })
      .from(tasks)
      .where(eq(tasks.project_id, projectId))

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

    // Delete all tasks if force is true (cascade will handle assignees/comments etc.)
    if (force && taskCount > 0) {
      await db.delete(tasks).where(eq(tasks.project_id, projectId))
    }

    // Delete the project
    await db.delete(projects).where(eq(projects.id, projectId))

    return NextResponse.json({
      message: "Project deleted successfully",
      deletedTasks: force ? taskCount : 0,
    })
  } catch (error) {
    console.error("Error deleting project:", error)
    return NextResponse.json({ error: "Failed to delete project" }, { status: 500 })
  }
}
