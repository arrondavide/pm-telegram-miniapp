import { NextResponse } from "next/server"
import { parseTaskFromText, parseMultipleTasks } from "@/lib/ai"
import { connectToDatabase } from "@/lib/mongodb"
import { User, Project, AIGeneration } from "@/lib/models"

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

    await connectToDatabase()

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
      const user = await User.findOne({ telegram_id: telegramId })
      if (user) {
        userId = user._id.toString()
        companyId = user.active_company_id?.toString()
      }
    }

    if (projectId) {
      const project = await Project.findById(projectId)
      if (project) {
        context.projectId = projectId
        context.projectName = project.name
        companyId = project.company_id.toString()

        // Get team members for this company
        const teamMembers = await User.find({
          "companies.company_id": project.company_id,
        }).select("full_name username")

        context.teamMembers = teamMembers.map(
          (m) => m.username || m.full_name
        )
      }
    }

    // Parse single or multiple tasks
    let result
    if (text) {
      result = await parseTaskFromText(text, context)

      // Log AI generation for learning
      if (userId && companyId) {
        await AIGeneration.create({
          user_id: userId,
          company_id: companyId,
          project_id: projectId,
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
        await AIGeneration.create({
          user_id: userId,
          company_id: companyId,
          project_id: projectId,
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
