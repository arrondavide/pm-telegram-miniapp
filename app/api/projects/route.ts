import { type NextRequest, NextResponse } from "next/server"
import { connectToDatabase } from "@/lib/mongodb"
import { Project, User } from "@/lib/models"
import { projectTransformer } from "@/lib/transformers"
import { validateBody, createProjectSchema } from "@/lib/validators"
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
        projects: projectTransformer.toList(fallbackProjects as any[]),
      })
    }

    return NextResponse.json({
      projects: projectTransformer.toList(projects as any[]),
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

    // Validate request body
    const validation = await validateBody(request, createProjectSchema)
    if (!validation.success) {
      return validation.error
    }

    const { companyId, name, description, color, icon, startDate, targetEndDate } = validation.data!

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

    // Create the project using transformer for database format
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
        project: projectTransformer.toFrontend(populatedProject as any),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
