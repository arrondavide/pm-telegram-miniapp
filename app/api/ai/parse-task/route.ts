import { NextResponse } from "next/server"
import { parseTaskFromText, parseMultipleTasks } from "@/lib/ai"
import { db, users, projects, aiGenerations, userCompanies } from "@/lib/db"
import { eq, inArray } from "drizzle-orm"
import { checkQuota } from "@/lib/quota"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, texts, projectId, telegramId } = body

    if (!text && (!texts || !Array.isArray(texts))) {
      return NextResponse.json(
        { success: false, error: "Either 'text' or 'texts' array is required" },
        { status: 400 }
      )
    }

    // Get context from project if provided
    let context: {
      projectId?: string
      projectName?: string
      teamMembers?: string[]
      existingTags?: string[]
    } = {}

    let userId: string | undefined
    let companyId: string | undefined

    if (telegramId) {
      const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
      if (user) {
        userId = user.id
        companyId = user.active_company_id ?? undefined
      }
    }

    if (projectId) {
      const project = await db.query.projects.findFirst({ where: eq(projects.id, projectId) })
      if (project) {
        context.projectId = projectId
        context.projectName = project.name
        companyId = project.company_id

        // Get team members for this company
        const memberships = await db
          .select()
          .from(userCompanies)
          .where(eq(userCompanies.company_id, project.company_id))

        const memberUserIds = memberships.map((m) => m.user_id)
        const memberUsers = memberUserIds.length > 0
          ? await db.select().from(users).where(inArray(users.id, memberUserIds))
          : []

        context.teamMembers = memberUsers
          .map((u) => u.username || u.full_name)
          .filter(Boolean)
      }
    }

    // Check AI quota — require company context to track usage
    if (!companyId) {
      return NextResponse.json(
        { success: false, error: "A company context is required to use AI features. Please select a company first.", quotaExceeded: true },
        { status: 403 }
      )
    }

    const quotaResult = await checkQuota(companyId, "ai_queries")
    if (!quotaResult.allowed) {
      return NextResponse.json(
        { success: false, error: quotaResult.message, quotaExceeded: true, planRequired: quotaResult.planRequired },
        { status: 403 }
      )
    }

    // Parse single or multiple tasks
    let result
    if (text) {
      result = await parseTaskFromText(text, context)

      // Log AI generation for learning
      if (userId && companyId) {
        await db.insert(aiGenerations).values({
          user_id: userId,
          company_id: companyId,
          project_id: projectId || null,
          type: "task_parse",
          input_prompt: text,
          generated_output: result as unknown as Record<string, unknown>,
          status: "pending",
        })
      }

      return NextResponse.json({
        success: true,
        data: { task: result },
      })
    } else {
      result = await parseMultipleTasks(texts, context)

      // Log AI generation for learning
      if (userId && companyId) {
        await db.insert(aiGenerations).values({
          user_id: userId,
          company_id: companyId,
          project_id: projectId || null,
          type: "task_parse",
          input_prompt: texts.join("\n"),
          generated_output: { tasks: result } as unknown as Record<string, unknown>,
          status: "pending",
        })
      }

      return NextResponse.json({
        success: true,
        data: { tasks: result },
      })
    }
  } catch (error) {
    console.error("Error parsing task:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to parse task",
      },
      { status: 500 }
    )
  }
}
