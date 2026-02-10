import { NextResponse } from "next/server"
import { generateProjectStructure } from "@/lib/ai"
import { connectToDatabase } from "@/lib/mongodb"
import { User, AIGeneration } from "@/lib/models"

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

    await connectToDatabase()

    // Get user context
    let userId: string | undefined
    let companyId: string | undefined

    if (telegramId) {
      const user = await User.findOne({ telegram_id: telegramId })
      if (user) {
        userId = user._id.toString()
        companyId = user.active_company_id?.toString()
      }
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
      await AIGeneration.create({
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
