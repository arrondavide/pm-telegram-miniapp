import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Project, User } from "@/lib/models"
import mongoose from "mongoose"

// GET /api/projects?companyId={id}
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!companyId || !telegramId) {
      return NextResponse.json({ error: "Company ID and Telegram ID required" }, { status: 400 })
    }

    await connectToDatabase()

    // Verify user has access to this company
    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const hasAccess = user.companies.some(
      (c: any) => c.company_id.toString() === companyId || c.company_id === companyId
    )

    if (!hasAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all projects for this company
    let companyObjectId: mongoose.Types.ObjectId | null = null
    let companyQuery: any = { company_id: companyId }

    if (mongoose.Types.ObjectId.isValid(companyId)) {
      companyObjectId = new mongoose.Types.ObjectId(companyId)
      companyQuery = { company_id: companyObjectId }
    }

    const projects = await Project.find(companyQuery)
      .populate("created_by", "telegram_id full_name username")
      .sort({ createdAt: -1 })
      .lean()

    // Fallback if ObjectId doesn't match
    if (projects.length === 0 && companyObjectId) {
      const fallbackProjects = await Project.find({ company_id: companyId })
        .populate("created_by", "telegram_id full_name username")
        .sort({ createdAt: -1 })
        .lean()

      return NextResponse.json({
        projects: fallbackProjects.map((p: any) => ({
          id: p._id.toString(),
          name: p.name,
          description: p.description || "",
          companyId: p.company_id.toString(),
          status: p.status,
          createdBy: {
            id: p.created_by?._id?.toString() || "",
            fullName: p.created_by?.full_name || "Unknown",
            username: p.created_by?.username || "",
            telegramId: p.created_by?.telegram_id || "",
          },
          color: p.color || "#3b82f6",
          icon: p.icon || "📁",
          startDate: p.start_date?.toISOString() || null,
          targetEndDate: p.target_end_date?.toISOString() || null,
          completedAt: p.completed_at?.toISOString() || null,
          archivedAt: p.archived_at?.toISOString() || null,
          createdAt: p.createdAt.toISOString(),
          updatedAt: p.updatedAt.toISOString(),
        })),
      })
    }

    return NextResponse.json({
      projects: projects.map((p: any) => ({
        id: p._id.toString(),
        name: p.name,
        description: p.description || "",
        companyId: p.company_id.toString(),
        status: p.status,
        createdBy: {
          id: p.created_by?._id?.toString() || "",
          fullName: p.created_by?.full_name || "Unknown",
          username: p.created_by?.username || "",
          telegramId: p.created_by?.telegram_id || "",
        },
        color: p.color || "#3b82f6",
        icon: p.icon || "📁",
        startDate: p.start_date?.toISOString() || null,
        targetEndDate: p.target_end_date?.toISOString() || null,
        completedAt: p.completed_at?.toISOString() || null,
        archivedAt: p.archived_at?.toISOString() || null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 })
  }
}

// POST /api/projects
export async function POST(request: NextRequest) {
  try {
    const telegramId = request.headers.get("X-Telegram-Id")
    if (!telegramId) {
      return NextResponse.json({ error: "Telegram ID required" }, { status: 400 })
    }

    const data = await request.json()
    const { companyId, name, description, color, icon, startDate, targetEndDate } = data

    if (!companyId || !name) {
      return NextResponse.json({ error: "Company ID and name required" }, { status: 400 })
    }

    await connectToDatabase()

    // Verify user exists and has access to this company
    const user = await User.findOne({ telegram_id: telegramId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const companyAccess = user.companies.find(
      (c: any) => c.company_id.toString() === companyId || c.company_id === companyId
    )

    if (!companyAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only admins and managers can create projects
    if (!["admin", "manager"].includes(companyAccess.role)) {
      return NextResponse.json({ error: "Only admins and managers can create projects" }, { status: 403 })
    }

    // Create the project
    const companyObjectId = mongoose.Types.ObjectId.isValid(companyId)
      ? new mongoose.Types.ObjectId(companyId)
      : companyId

    const project = await Project.create({
      name,
      description: description || "",
      company_id: companyObjectId,
      status: "active",
      created_by: user._id,
      color: color || "#3b82f6",
      icon: icon || "📁",
      start_date: startDate ? new Date(startDate) : undefined,
      target_end_date: targetEndDate ? new Date(targetEndDate) : undefined,
    })

    const populatedProject = await Project.findById(project._id)
      .populate("created_by", "telegram_id full_name username")
      .lean()

    return NextResponse.json(
      {
        project: {
          id: populatedProject!._id.toString(),
          name: populatedProject!.name,
          description: populatedProject!.description || "",
          companyId: populatedProject!.company_id.toString(),
          status: populatedProject!.status,
          createdBy: {
            id: (populatedProject!.created_by as any)?._id?.toString() || "",
            fullName: (populatedProject!.created_by as any)?.full_name || "Unknown",
            username: (populatedProject!.created_by as any)?.username || "",
            telegramId: (populatedProject!.created_by as any)?.telegram_id || "",
          },
          color: populatedProject!.color || "#3b82f6",
          icon: populatedProject!.icon || "📁",
          startDate: populatedProject!.start_date?.toISOString() || null,
          targetEndDate: populatedProject!.target_end_date?.toISOString() || null,
          completedAt: populatedProject!.completed_at?.toISOString() || null,
          archivedAt: populatedProject!.archived_at?.toISOString() || null,
          createdAt: (populatedProject as any)!.createdAt.toISOString(),
          updatedAt: (populatedProject as any)!.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
