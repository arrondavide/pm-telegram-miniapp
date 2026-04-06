import { type NextRequest, NextResponse } from "next/server"
import { db, projects, users, userCompanies } from "@/lib/db"
import { eq, and } from "drizzle-orm"
import { projectTransformer } from "@/lib/transformers"
import { validateBody, createProjectSchema } from "@/lib/validators"
import { checkQuota } from "@/lib/quota"

// GET /api/projects?companyId={id}
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get("companyId")
    const telegramId = request.headers.get("X-Telegram-Id")

    if (!companyId || !telegramId) {
      return NextResponse.json({ error: "Company ID and Telegram ID required" }, { status: 400 })
    }

    // Verify user has access to this company
    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const access = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, companyId)),
    })

    if (!access) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Get all projects for this company with created_by user info
    const projectRows = await db.query.projects.findMany({
      where: eq(projects.company_id, companyId),
      with: { created_by: true },
      orderBy: (p, { desc }) => [desc(p.created_at)],
    })

    const formatted = projectRows.map((p) =>
      projectTransformer.toFrontend({
        _id: { toString: () => p.id },
        name: p.name,
        description: p.description ?? "",
        company_id: p.company_id,
        status: p.status,
        created_by: p.created_by
          ? { _id: { toString: () => (p.created_by as any).id }, telegram_id: (p.created_by as any).telegram_id, full_name: (p.created_by as any).full_name, username: (p.created_by as any).username ?? "" }
          : p.created_by ?? "",
        color: p.color ?? "#3b82f6",
        icon: p.icon ?? "📁",
        start_date: p.start_date ?? undefined,
        target_end_date: p.target_end_date ?? undefined,
        completed_at: p.completed_at ?? undefined,
        archived_at: p.archived_at ?? undefined,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      } as any)
    )

    return NextResponse.json({ projects: formatted })
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

    // Verify user exists and has access to this company
    const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const companyAccess = await db.query.userCompanies.findFirst({
      where: and(eq(userCompanies.user_id, user.id), eq(userCompanies.company_id, companyId)),
    })

    if (!companyAccess) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 })
    }

    // Only admins and managers can create projects
    if (!["admin", "manager"].includes(companyAccess.role)) {
      return NextResponse.json({ error: "Only admins and managers can create projects" }, { status: 403 })
    }

    // Check project quota
    const quotaResult = await checkQuota(companyId, "projects")
    if (!quotaResult.allowed) {
      return NextResponse.json(
        { error: quotaResult.message, quotaExceeded: true, planRequired: quotaResult.planRequired },
        { status: 403 }
      )
    }

    // Create the project
    const [project] = await db
      .insert(projects)
      .values({
        name,
        description: description || "",
        company_id: companyId,
        status: "active",
        created_by: user.id,
        color: color || "#3b82f6",
        icon: icon || "📁",
        start_date: startDate ? new Date(startDate) : undefined,
        target_end_date: targetEndDate ? new Date(targetEndDate) : undefined,
      })
      .returning()

    // Fetch creator info for response
    const creatorUser = await db.query.users.findFirst({ where: eq(users.id, user.id) })

    return NextResponse.json(
      {
        project: projectTransformer.toFrontend({
          _id: { toString: () => project.id },
          name: project.name,
          description: project.description ?? "",
          company_id: project.company_id,
          status: project.status,
          created_by: creatorUser
            ? { _id: { toString: () => creatorUser.id }, telegram_id: creatorUser.telegram_id, full_name: creatorUser.full_name, username: creatorUser.username ?? "" }
            : project.created_by ?? "",
          color: project.color ?? "#3b82f6",
          icon: project.icon ?? "📁",
          start_date: project.start_date ?? undefined,
          target_end_date: project.target_end_date ?? undefined,
          completed_at: project.completed_at ?? undefined,
          archived_at: project.archived_at ?? undefined,
          createdAt: project.created_at,
          updatedAt: project.updated_at,
        } as any),
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Error creating project:", error)
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 })
  }
}
