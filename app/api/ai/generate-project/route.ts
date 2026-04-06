import { NextResponse } from "next/server"
import { generateProjectStructure } from "@/lib/ai"
import { db, users, aiGenerations } from "@/lib/db"
import { eq } from "drizzle-orm"
import { checkQuota } from "@/lib/quota"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { description, teamSize, duration, projectType, constraints, telegramId } = body

    if (!description) {
      return NextResponse.json(
        { success: false, error: "Project description is required" },
        { status: 400 }
      )
    }

    // Get user context
    let userId: string | undefined
    let companyId: string | undefined

    if (telegramId) {
      const user = await db.query.users.findFirst({ where: eq(users.telegram_id, telegramId) })
      if (user) {
        userId = user.id
        companyId = user.active_company_id ?? undefined
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

    // Generate project structure
    const result = await generateProjectStructure(description, {
      teamSize,
      duration,
      projectType,
      constraints,
    })

    // Log AI generation for learning
    if (userId && companyId) {
      await db.insert(aiGenerations).values({
        user_id: userId,
        company_id: companyId,
        type: "project_structure",
        input_prompt: description,
        input_context: { teamSize, duration, projectType, constraints } as Record<string, unknown>,
        generated_output: result as unknown as Record<string, unknown>,
        status: "pending",
      })
    }

    return NextResponse.json({
      success: true,
      data: result,
    })
  } catch (error) {
    console.error("Error generating project:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate project structure",
      },
      { status: 500 }
    )
  }
}
